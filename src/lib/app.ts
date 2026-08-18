import { isAvatar } from "./avatars.ts";
import { utcDate } from "./date.ts";
import { dayIndexOf, layoutPair, pickSourcesForDate, ROUNDS, toPublic } from "./pairs.ts";
import {
  CLAIM_LIMIT,
  COMMENT_LIMIT,
  GUESS_LIMIT,
  claimKey,
  commentKey,
  consume,
  guessKey,
  type RateStore,
} from "./rate-limit.ts";
import { pointsDelta } from "./scoring.ts";
import type { Store } from "./store.ts";
import { checkUsername, usernameMessage } from "./username.ts";
import type {
  BoardResult,
  Clock,
  CommentRow,
  GuessResult,
  IdGen,
  MeResult,
  NextResult,
  PairRecord,
  PairSource,
  Session,
  Side,
} from "../types.ts";

export interface AppDeps {
  store: Store;
  rates: RateStore;
  clock: Clock;
  ids: IdGen;
  sources?: PairSource[];
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class HumaneApp {
  private seededFor: string | null = null;

  constructor(private readonly deps: AppDeps) {}

  todayDate(): string {
    return utcDate(this.deps.clock.now());
  }

  async ensureSeeded(): Promise<void> {
    if (!this.deps.sources?.length) return;
    const date = this.todayDate();
    if (this.seededFor === date) return;
    const have = await this.deps.store.listPairsForDate(date);
    if (have.length >= ROUNDS) {
      this.seededFor = date;
      return;
    }
    const now = this.deps.clock.now().toISOString();
    const exact = this.deps.sources.filter((s) => s.play_date === date);
    const pack = exact.length ? exact : pickSourcesForDate(this.deps.sources, date);
    for (const src of pack) {
      const id = exact.length ? src.id : `${date}:${src.id}`;
      await this.deps.store.insertPair(recordFromSource(src, id, date, now));
    }
    this.seededFor = date;
  }

  async next(session: Session): Promise<NextResult> {
    const player = await this.requirePlayer(session);
    await this.ensureSeeded();
    const date = this.todayDate();
    const pack = await this.deps.store.listPairsForDate(date);
    const guessed = new Set(await this.deps.store.listGuessedPairIds(player.id, date));
    const unused = pack.filter((p) => !guessed.has(p.id));
    const scoreToday = await this.deps.store.todayScore(player.id, date);
    if (!unused.length || guessed.size >= ROUNDS) {
      return { done: true, scoreToday, scoreTotal: player.score_total };
    }
    return toPublic(unused[0]);
  }

  async claim(
    session: Session,
    username: string,
    avatarRaw: string,
    ip: string,
  ): Promise<{ session: Session; username: string; avatar: string }> {
    if (!isAvatar(avatarRaw)) throw new AppError(400, "bad_avatar", "Pick a face.");

    if (session.playerId) {
      const existing = await this.deps.store.getPlayer(session.playerId);
      if (existing) {
        await this.deps.store.updatePlayer(existing.id, { avatar: avatarRaw });
        return { session, username: existing.username_display, avatar: avatarRaw };
      }
    }

    const rate = await consume(this.deps.rates, claimKey(ip), CLAIM_LIMIT, this.deps.clock.now().getTime());
    if (!rate.ok) throw new AppError(429, "rate_limited", "Slow down.");

    const check = checkUsername(username);
    if (!check.ok) throw new AppError(400, check.error!, usernameMessage(check.error!));

    const now = this.deps.clock.now().toISOString();
    const playerId = this.deps.ids.id();
    const inserted = await this.deps.store.insertPlayer({
      id: playerId,
      username_norm: check.norm,
      username_display: check.display,
      avatar: avatarRaw,
      created_at: now,
      score_total: 0,
    });
    if (inserted === "conflict") throw new AppError(409, "taken", "Taken.");
    return { session: { id: session.id, playerId }, username: check.display, avatar: avatarRaw };
  }

  async guess(session: Session, pairId: string, side: Side, ip: string): Promise<GuessResult> {
    if (side !== "left" && side !== "right") throw new AppError(400, "bad_side", "Pick a card.");
    if (!pairId) throw new AppError(400, "bad_pair", "Missing pair.");
    const player = await this.requirePlayer(session);
    const rate = await consume(this.deps.rates, guessKey(player.id), GUESS_LIMIT, this.deps.clock.now().getTime());
    if (!rate.ok) throw new AppError(429, "rate_limited", "Slow down.");
    await this.ensureSeeded();
    const date = this.todayDate();
    const pack = await this.deps.store.listPairsForDate(date);
    if (!pack.length) throw new AppError(404, "no_pair", "No table today.");

    const played = await this.deps.store.guessCountToday(player.id, date);
    if (played >= ROUNDS) throw new AppError(409, "done_today", "Today's five are cut.");

    const pair = pack.find((p) => p.id === pairId);
    if (!pair) throw new AppError(404, "no_pair", "That pair is gone.");

    const prior = await this.deps.store.getGuess(player.id, pair.id);
    if (prior) throw new AppError(409, "already_guessed", "Already cut.");

    const correct = side === pair.human_side;
    const delta = pointsDelta(correct);
    const inserted = await this.deps.store.insertGuess({
      id: this.deps.ids.id(),
      player_id: player.id,
      play_date: date,
      pair_id: pair.id,
      picked_side: side,
      correct,
      created_at: this.deps.clock.now().toISOString(),
    });
    if (inserted === "conflict") throw new AppError(409, "already_guessed", "Already cut.");

    const scoreTotal = player.score_total + delta;
    await this.deps.store.updatePlayer(player.id, { score_total: scoreTotal });
    const scoreToday = await this.deps.store.todayScore(player.id, date);
    const guessed = new Set(await this.deps.store.listGuessedPairIds(player.id, date));
    const still = pack.filter((p) => !guessed.has(p.id));
    const round = guessed.size;
    return {
      correct,
      humanSide: pair.human_side,
      tell: pair.tell,
      source: pair.human_source,
      model: pair.ai_model,
      pointsDelta: delta,
      scoreToday,
      scoreTotal,
      round,
      of: ROUNDS,
      next: still[0] && round < ROUNDS ? toPublic(still[0]) : null,
    };
  }

  async me(session: Session): Promise<MeResult> {
    const date = this.todayDate();
    const empty: MeResult = {
      username: null,
      avatar: null,
      date,
      scoreToday: 0,
      scoreTotal: 0,
      round: 1,
      of: ROUNDS,
      doneToday: false,
    };
    if (!session.playerId) return empty;
    const player = await this.deps.store.getPlayer(session.playerId);
    if (!player) return empty;
    const played = await this.deps.store.guessCountToday(player.id, date);
    const scoreToday = await this.deps.store.todayScore(player.id, date);
    const doneToday = played >= ROUNDS;
    return {
      username: player.username_display,
      avatar: player.avatar,
      date,
      scoreToday,
      scoreTotal: player.score_total,
      round: doneToday ? ROUNDS : played + 1,
      of: ROUNDS,
      doneToday,
    };
  }

  async board(): Promise<BoardResult> {
    const date = this.todayDate();
    const [today, alltime] = await Promise.all([
      this.deps.store.boardToday(date, 50),
      this.deps.store.boardAllTime(50),
    ]);
    return { today, alltime };
  }

  async comments(): Promise<CommentRow[]> {
    return this.deps.store.listComments(40);
  }

  async postComment(session: Session, raw: string, ip: string): Promise<CommentRow> {
    const player = await this.requirePlayer(session);
    const rate = await consume(
      this.deps.rates,
      commentKey(ip),
      COMMENT_LIMIT,
      this.deps.clock.now().getTime(),
    );
    if (!rate.ok) throw new AppError(429, "rate_limited", "Slow down.");
    const body = raw.replace(/\s+/g, " ").trim();
    if (body.length < 1) throw new AppError(400, "empty", "Write something.");
    if (body.length > 160) throw new AppError(400, "too_long", "Keep it under 160.");
    const created = this.deps.clock.now().toISOString();
    const id = this.deps.ids.id();
    await this.deps.store.insertComment({ id, player_id: player.id, body, created_at: created });
    return {
      id,
      username: player.username_display,
      avatar: player.avatar,
      body,
      created_at: created,
    };
  }

  private async requirePlayer(session: Session) {
    if (!session.playerId) throw new AppError(401, "need_name", "Take a name first.");
    const player = await this.deps.store.getPlayer(session.playerId);
    if (!player) throw new AppError(401, "need_name", "Take a name first.");
    return player;
  }
}

function recordFromSource(src: PairSource, id: string, playDate: string, now: string): PairRecord {
  const laid = layoutPair(src);
  return {
    id,
    play_date: playDate,
    day_index: dayIndexOf(src),
    topic: src.topic,
    left_text: laid.left_text,
    right_text: laid.right_text,
    human_side: laid.human_side,
    human_source: src.human_source,
    ai_model: src.ai_model,
    tell: src.tell,
    created_at: now,
  };
}

export function newSessionId(ids: IdGen): Session {
  return { id: ids.id(), playerId: null };
}
