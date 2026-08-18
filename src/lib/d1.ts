import type { CommentRow, GuessRecord, PairRecord, PlayerRecord, Side } from "../types.ts";
import type { AllTimeRow, Store, TodayRow } from "./store.ts";

export class D1Store implements Store {
  constructor(private readonly db: D1Database) {}

  async getPairById(id: string): Promise<PairRecord | null> {
    return (await this.db.prepare("SELECT * FROM pairs WHERE id = ?").bind(id).first<PairRecord>()) ?? null;
  }

  async listPairsForDate(date: string): Promise<PairRecord[]> {
    const res = await this.db
      .prepare("SELECT * FROM pairs WHERE play_date = ? ORDER BY day_index")
      .bind(date)
      .all<PairRecord>();
    return res.results ?? [];
  }

  async insertPair(pair: PairRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO pairs
         (id, play_date, day_index, topic, left_text, right_text, human_side, human_source, ai_model, tell, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pair.id,
        pair.play_date,
        pair.day_index,
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
           (id, username_norm, username_display, avatar, created_at, score_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          player.id,
          player.username_norm,
          player.username_display,
          player.avatar,
          player.created_at,
          player.score_total,
        )
        .run();
      return "ok";
    } catch (err) {
      if (isUnique(err)) return "conflict";
      throw err;
    }
  }

  async updatePlayer(id: string, patch: { avatar?: string; score_total?: number }): Promise<void> {
    const cur = await this.getPlayer(id);
    if (!cur) return;
    await this.db
      .prepare(`UPDATE players SET avatar = ?, score_total = ? WHERE id = ?`)
      .bind(patch.avatar ?? cur.avatar, patch.score_total ?? cur.score_total, id)
      .run();
  }

  async getGuess(playerId: string, pairId: string): Promise<GuessRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM guesses WHERE player_id = ? AND pair_id = ?")
      .bind(playerId, pairId)
      .first<GuessRow>();
    return row ? mapGuess(row) : null;
  }

  async insertGuess(guess: GuessRecord): Promise<"ok" | "conflict"> {
    try {
      await this.db
        .prepare(
          `INSERT INTO guesses (id, player_id, play_date, pair_id, picked_side, correct, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          guess.id,
          guess.player_id,
          guess.play_date,
          guess.pair_id,
          guess.picked_side,
          guess.correct ? 1 : 0,
          guess.created_at,
        )
        .run();
      return "ok";
    } catch (err) {
      if (isUnique(err)) return "conflict";
      throw err;
    }
  }

  async listGuessedPairIds(playerId: string, date: string): Promise<string[]> {
    const res = await this.db
      .prepare("SELECT pair_id FROM guesses WHERE player_id = ? AND play_date = ?")
      .bind(playerId, date)
      .all<{ pair_id: string }>();
    return (res.results ?? []).map((r) => r.pair_id);
  }

  async todayScore(playerId: string, date: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM guesses WHERE player_id = ? AND play_date = ? AND correct = 1`)
      .bind(playerId, date)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async guessCountToday(playerId: string, date: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM guesses WHERE player_id = ? AND play_date = ?`)
      .bind(playerId, date)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async boardToday(date: string, limit: number): Promise<TodayRow[]> {
    const res = await this.db
      .prepare(
        `SELECT p.username_display AS username, p.avatar AS avatar,
                SUM(CASE WHEN g.correct = 1 THEN 1 ELSE 0 END) AS scoreToday
         FROM guesses g
         JOIN players p ON p.id = g.player_id
         WHERE g.play_date = ?
         GROUP BY g.player_id
         ORDER BY scoreToday DESC, p.username_display ASC
         LIMIT ?`,
      )
      .bind(date, limit)
      .all<TodayRow>();
    return res.results ?? [];
  }

  async boardAllTime(limit: number): Promise<AllTimeRow[]> {
    const res = await this.db
      .prepare(
        `SELECT username_display AS username, avatar, score_total AS scoreTotal
         FROM players
         ORDER BY score_total DESC, username_display ASC
         LIMIT ?`,
      )
      .bind(limit)
      .all<AllTimeRow>();
    return res.results ?? [];
  }

  async listComments(limit: number): Promise<CommentRow[]> {
    const res = await this.db
      .prepare(
        `SELECT c.id AS id, p.username_display AS username, p.avatar AS avatar,
                c.body AS body, c.created_at AS created_at
         FROM comments c
         JOIN players p ON p.id = c.player_id
         ORDER BY c.created_at DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<CommentRow>();
    return res.results ?? [];
  }

  async insertComment(row: { id: string; player_id: string; body: string; created_at: string }): Promise<void> {
    await this.db
      .prepare(`INSERT INTO comments (id, player_id, body, created_at) VALUES (?, ?, ?, ?)`)
      .bind(row.id, row.player_id, row.body, row.created_at)
      .run();
  }
}

interface GuessRow {
  id: string;
  player_id: string;
  play_date: string;
  pair_id: string;
  picked_side: Side;
  correct: number;
  created_at: string;
}

function mapGuess(row: GuessRow): GuessRecord {
  return {
    id: row.id,
    player_id: row.player_id,
    play_date: row.play_date,
    pair_id: row.pair_id,
    picked_side: row.picked_side,
    correct: !!row.correct,
    created_at: row.created_at,
  };
}

function isUnique(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique/i.test(msg) || /constraint/i.test(msg);
}
