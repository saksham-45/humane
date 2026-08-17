import type { GuessRecord, PairRecord, PlayerRecord, Side } from "../types.ts";
import type { BoardEntry, Store } from "./store.ts";

export class D1Store implements Store {
  constructor(
    private readonly db: D1Database,
    private readonly kv: KVNamespace,
  ) {}

  async getPair(date: string): Promise<PairRecord | null> {
    return (await this.db.prepare("SELECT * FROM pairs WHERE play_date = ?").bind(date).first<PairRecord>()) ?? null;
  }

  async listPairDates(): Promise<string[]> {
    const res = await this.db.prepare("SELECT play_date FROM pairs ORDER BY play_date").all<{ play_date: string }>();
    return (res.results ?? []).map((r) => r.play_date);
  }

  async insertPair(pair: PairRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO pairs
         (id, play_date, topic, left_text, right_text, human_side, human_source, ai_model, tell, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pair.id,
        pair.play_date,
        pair.topic,
        pair.left_text,
        pair.right_text,
        pair.human_side,
        pair.human_source,
        pair.ai_model,
        pair.tell,
        pair.created_at,
      )
      .run();
  }

  async pairCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS n FROM pairs").first<{ n: number }>();
    return row?.n ?? 0;
  }

  async getPlayer(id: string): Promise<PlayerRecord | null> {
    return (await this.db.prepare("SELECT * FROM players WHERE id = ?").bind(id).first<PlayerRecord>()) ?? null;
  }

  async getPlayerByNorm(norm: string): Promise<PlayerRecord | null> {
    return (
      (await this.db.prepare("SELECT * FROM players WHERE username_norm = ?").bind(norm).first<PlayerRecord>()) ?? null
    );
  }

  async insertPlayer(player: PlayerRecord): Promise<"ok" | "conflict"> {
    try {
      await this.db
        .prepare(
          `INSERT INTO players
           (id, username_norm, username_display, created_at, current_streak, longest_streak, last_play_date, last_result)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          player.id,
          player.username_norm,
          player.username_display,
          player.created_at,
          player.current_streak,
          player.longest_streak,
          player.last_play_date,
          player.last_result,
        )
        .run();
      return "ok";
    } catch (err) {
      if (isUnique(err)) return "conflict";
      throw err;
    }
  }

  async updatePlayerStreak(
    id: string,
    patch: {
      current_streak: number;
      longest_streak: number;
      last_play_date: string;
      last_result: string;
    },
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE players SET current_streak = ?, longest_streak = ?, last_play_date = ?, last_result = ? WHERE id = ?`,
      )
      .bind(patch.current_streak, patch.longest_streak, patch.last_play_date, patch.last_result, id)
      .run();
  }

  async playerCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>();
    return row?.n ?? 0;
  }

  async getGuess(playerId: string, date: string): Promise<GuessRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM guesses WHERE player_id = ? AND play_date = ?")
      .bind(playerId, date)
      .first<GuessRow>();
    return row ? mapGuess(row) : null;
  }

  async insertGuess(guess: GuessRecord): Promise<"ok" | "conflict"> {
    try {
      await this.db
        .prepare(
          `INSERT INTO guesses (id, player_id, play_date, picked_side, correct, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(guess.id, guess.player_id, guess.play_date, guess.picked_side, guess.correct ? 1 : 0, guess.created_at)
        .run();
      return "ok";
    } catch (err) {
      if (isUnique(err)) return "conflict";
      throw err;
    }
  }

  async board(date: string, limit: number): Promise<BoardEntry[]> {
    const res = await this.db
      .prepare(
        `SELECT p.id AS player_id, p.username_display, p.current_streak, p.longest_streak,
                g.created_at AS today_correct_at
         FROM players p
         LEFT JOIN guesses g ON g.player_id = p.id AND g.play_date = ? AND g.correct = 1
         ORDER BY p.current_streak DESC, p.longest_streak DESC,
                  CASE WHEN g.created_at IS NULL THEN 1 ELSE 0 END,
                  g.created_at ASC
         LIMIT ?`,
      )
      .bind(date, limit)
      .all<BoardEntry>();
    return res.results ?? [];
  }

  async rankOf(playerId: string, date: string): Promise<{ rank: number; row: BoardEntry } | null> {
    const row = await this.db
      .prepare(
        `WITH ranked AS (
           SELECT p.id AS player_id, p.username_display, p.current_streak, p.longest_streak,
                  g.created_at AS today_correct_at,
                  ROW_NUMBER() OVER (
                    ORDER BY p.current_streak DESC, p.longest_streak DESC,
                             CASE WHEN g.created_at IS NULL THEN 1 ELSE 0 END,
                             g.created_at ASC
                  ) AS rank
           FROM players p
           LEFT JOIN guesses g ON g.player_id = p.id AND g.play_date = ? AND g.correct = 1
         )
         SELECT * FROM ranked WHERE player_id = ?`,
      )
      .bind(date, playerId)
      .first<BoardEntry & { rank: number }>();
    if (!row) return null;
    return {
      rank: Number(row.rank),
      row: {
        player_id: row.player_id,
        username_display: row.username_display,
        current_streak: row.current_streak,
        longest_streak: row.longest_streak,
        today_correct_at: row.today_correct_at,
      },
    };
  }

  async getAnonGuess(sessionId: string, date: string): Promise<{ side: Side; correct: boolean } | null> {
    const raw = await this.kv.get(`anon:${sessionId}:${date}`, "json");
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as { side?: Side; correct?: boolean };
    if (obj.side !== "left" && obj.side !== "right") return null;
    return { side: obj.side, correct: !!obj.correct };
  }

  async putAnonGuess(sessionId: string, date: string, side: Side, correct: boolean): Promise<void> {
    await this.kv.put(`anon:${sessionId}:${date}`, JSON.stringify({ side, correct }), {
      expirationTtl: 60 * 60 * 48,
    });
  }
}

interface GuessRow {
  id: string;
  player_id: string;
  play_date: string;
  picked_side: Side;
  correct: number;
  created_at: string;
}

function mapGuess(row: GuessRow): GuessRecord {
  return {
    id: row.id,
    player_id: row.player_id,
    play_date: row.play_date,
    picked_side: row.picked_side,
    correct: !!row.correct,
    created_at: row.created_at,
  };
}

function isUnique(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique/i.test(msg) || /constraint/i.test(msg);
}
