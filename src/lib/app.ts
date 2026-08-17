import type { Clock, GuessResult, IdGen, PairRecord, PairSource, Session, Side } from "../types.ts";
import { utcDate } from "./date.ts";
import { layoutPair } from "./pairs.ts";
import { CLAIM_LIMIT, GUESS_LIMIT, claimKey, consume, guessKey, type RateStore } from "./rate-limit.ts";
import { nextStreak } from "./scoring.ts";
import type { Store } from "./store.ts";
import { checkUsername, usernameMessage } from "./username.ts";

export interface AppDeps {
  store: Store;
  rates: RateStore;
  clock: Clock;
  ids: IdGen;
  sources?: PairSource[];
}

export class AlreadyGuessedError extends Error {
  constructor(public readonly result: GuessResult) {
    super("already_guessed");
  }
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
  constructor(private readonly deps: AppDeps) {}

  todayDate(): string {
    return utcDate(this.deps.clock.now());
  }

  async ensureSeeded(): Promise<void> {
    if (!this.deps.sources?.length) return;
    if ((await this.deps.store.pairCount()) > 0) return;
    const now = this.deps.clock.now().toISOString();
    for (const src of this.deps.sources) {
      const laid = layoutPair(src);
      const rec: PairRecord = {
        id: src.id,
        play_date: src.play_date,
        topic: src.topic,
        left_text: laid.left_text,
        right_text: laid.right_text,
        human_side: laid.human_side,
        human_source: src.human_source,
        ai_model: src.ai_model,
        tell: src.tell,
        created_at: now,
      };
      await this.deps.store.insertPair(rec);
    }
  }

  async today(): Promise<{
    date: string;
    topic: string;
    left: string;
    right: string;
    players: number;
  } | null> {
    await this.ensureSeeded();
    const date = this.todayDate();
    const pair = await this.deps.store.getPair(date);
    if (!pair) return null;
    const players = await this.deps.store.playerCount();
    return {
      date,
      topic: pair.topic,
      left: pair.left_text,
      right: pair.right_text,
      players,
    };
  }

  async available(username: string): Promise<{ available: boolean; reason?: string }> {
    const check = checkUsername(username);
    if (!check.ok) return { available: false, reason: usernameMessage(check.error!) };
    const existing = await this.deps.store.getPlayerByNorm(check.norm);
    if (existing) return { available: false, reason: "Taken." };
    return { available: true };
  }

  async claim(session: Session, username: string, ip: string): Promise<{
    session: Session;
    username: string;
  }> {
    const rate = await consume(this.deps.rates, claimKey(ip), CLAIM_LIMIT, this.deps.clock.now().getTime());
    if (!rate.ok) throw new AppError(429, "rate_limited", "Slow the stamp.");

    if (session.playerId) {
      const existing = await this.deps.store.getPlayer(session.playerId);
      if (existing) throw new AppError(409, "already_claimed", `You are ${existing.username_display}.`);
    }

    const check = checkUsername(username);
    if (!check.ok) throw new AppError(400, check.error!, usernameMessage(check.error!));

    const now = this.deps.clock.now().toISOString();
    const playerId = this.deps.ids.id();
    const inserted = await this.deps.store.insertPlayer({
      id: playerId,
      username_norm: check.norm,
      username_display: check.display,
      created_at: now,
      current_streak: 0,
      longest_streak: 0,
      last_play_date: null,
      last_result: null,
    });
    if (inserted === "conflict") throw new AppError(409, "taken", "Taken.");

    const date = this.todayDate();
    const anon = await this.deps.store.getAnonGuess(session.id, date);
    if (anon) {
      const pair = await this.deps.store.getPair(date);
      if (pair) {
        await this.persistGuess(playerId, date, anon.side, anon.correct, pair);
      }
    }

    return { session: { id: session.id, playerId }, username: check.display };
  }

  async guess(session: Session, side: Side, ip: string): Promise<{ result: GuessResult; session: Session }> {
    if (side !== "left" && side !== "right") {
      throw new AppError(400, "bad_side", "Pick a column.");
    }
    const rate = await consume(this.deps.rates, guessKey(ip), GUESS_LIMIT, this.deps.clock.now().getTime());
    if (!rate.ok) throw new AppError(429, "rate_limited", "Slow the stamp.");

    await this.ensureSeeded();
    const date = this.todayDate();
    const pair = await this.deps.store.getPair(date);
    if (!pair) throw new AppError(404, "no_pair", "No cut today. The desk is empty.");

    if (session.playerId) {
      const prior = await this.deps.store.getGuess(session.playerId, date);
      if (prior) {
        const player = await this.deps.store.getPlayer(session.playerId);
        throw new AlreadyGuessedError({
          correct: prior.correct,
          humanSide: pair.human_side,
          tell: pair.tell,
          source: pair.human_source,
          model: pair.ai_model,
          streak: player?.current_streak ?? 0,
          longest: player?.longest_streak ?? 0,
          persisted: true,
          already: true,
        });
      }
    } else {
      const prior = await this.deps.store.getAnonGuess(session.id, date);
      if (prior) {
        throw new AlreadyGuessedError({
          correct: prior.correct,
          humanSide: pair.human_side,
          tell: pair.tell,
          source: pair.human_source,
          model: pair.ai_model,
          streak: prior.correct ? 1 : 0,
          longest: prior.correct ? 1 : 0,
          persisted: false,
          already: true,
        });
      }
    }

    const correct = side === pair.human_side;
    const base: GuessResult = {
      correct,
      humanSide: pair.human_side,
      tell: pair.tell,
      source: pair.human_source,
      model: pair.ai_model,
      streak: correct ? 1 : 0,
      longest: correct ? 1 : 0,
      persisted: false,
    };

    if (!session.playerId) {
      await this.deps.store.putAnonGuess(session.id, date, side, correct);
      return { result: base, session };
    }

    const persisted = await this.persistGuess(session.playerId, date, side, correct, pair);
    return { result: { ...base, ...persisted, persisted: true }, session };
  }

  async me(session: Session): Promise<{
    date: string;
    username: string | null;
    streak: number;
    longest: number;
    guessedToday: boolean;
    lastResult: string | null;
  }> {
    const date = this.todayDate();
    if (!session.playerId) {
      const anon = await this.deps.store.getAnonGuess(session.id, date);
      return {
        date,
        username: null,
        streak: 0,
        longest: 0,
        guessedToday: !!anon,
        lastResult: anon ? (anon.correct ? "correct" : "wrong") : null,
      };
    }
    const player = await this.deps.store.getPlayer(session.playerId);
    if (!player) {
      return { date, username: null, streak: 0, longest: 0, guessedToday: false, lastResult: null };
    }
    const guess = await this.deps.store.getGuess(player.id, date);
    return {
      date,
      username: player.username_display,
      streak: player.current_streak,
      longest: player.longest_streak,
      guessedToday: !!guess,
      lastResult: player.last_result,
    };
  }

  async board(session: Session): Promise<{
    date: string;
    rows: Array<{
      rank: number;
      username: string;
      current: number;
      longest: number;
      you?: boolean;
    }>;
    you: { rank: number; username: string; current: number; longest: number } | null;
  }> {
    const date = this.todayDate();
    const top = await this.deps.store.board(date, 50);
    const youId = session.playerId;
    const rows = top.map((r, i) => ({
      rank: i + 1,
      username: r.username_display,
      current: r.current_streak,
      longest: r.longest_streak,
      you: youId === r.player_id ? true : undefined,
    }));
    let you: { rank: number; username: string; current: number; longest: number } | null = null;
    if (youId) {
      const found = await this.deps.store.rankOf(youId, date);
      if (found) {
        you = {
          rank: found.rank,
          username: found.row.username_display,
          current: found.row.current_streak,
          longest: found.row.longest_streak,
        };
      }
    }
    return { date, rows, you };
  }

  async playerByName(username: string): Promise<{ username: string; current: number; longest: number } | null> {
    const check = checkUsername(username);
    if (!check.ok) return null;
    const player = await this.deps.store.getPlayerByNorm(check.norm);
    if (!player) return null;
    return {
      username: player.username_display,
      current: player.current_streak,
      longest: player.longest_streak,
    };
  }

  private async persistGuess(
    playerId: string,
    date: string,
    side: Side,
    correct: boolean,
    _pair: PairRecord,
  ): Promise<{ streak: number; longest: number }> {
    const player = await this.deps.store.getPlayer(playerId);
    if (!player) throw new AppError(401, "no_player", "Claim a name first.");
    const inserted = await this.deps.store.insertGuess({
      id: this.deps.ids.id(),
      player_id: playerId,
      play_date: date,
      picked_side: side,
      correct,
      created_at: this.deps.clock.now().toISOString(),
    });
    if (inserted === "conflict") {
      throw new AppError(409, "already_guessed", "You already cut today.");
    }
    const streak = nextStreak(player, date, correct);
    await this.deps.store.updatePlayerStreak(playerId, {
      current_streak: streak.current,
      longest_streak: streak.longest,
      last_play_date: date,
      last_result: streak.last_result,
    });
    return { streak: streak.current, longest: streak.longest };
  }
}

export function newSessionId(ids: IdGen): Session {
  return { id: ids.id(), playerId: null };
}
