import type { CommentRow, GuessRecord, PairRecord, PlayerRecord } from "../types.ts";

export interface TodayRow {
  username: string;
  avatar: string;
  scoreToday: number;
}

export interface AllTimeRow {
  username: string;
  avatar: string;
  scoreTotal: number;
}

export interface Store {
  getPairById(id: string): Promise<PairRecord | null>;
  listPairsForDate(date: string): Promise<PairRecord[]>;
  insertPair(pair: PairRecord): Promise<void>;

  getPlayer(id: string): Promise<PlayerRecord | null>;
  getPlayerByNorm(norm: string): Promise<PlayerRecord | null>;
  insertPlayer(player: PlayerRecord): Promise<"ok" | "conflict">;
  updatePlayer(id: string, patch: { avatar?: string; score_total?: number }): Promise<void>;

  getGuess(playerId: string, pairId: string): Promise<GuessRecord | null>;
  insertGuess(guess: GuessRecord): Promise<"ok" | "conflict">;
  listGuessedPairIds(playerId: string, date: string): Promise<string[]>;
  todayScore(playerId: string, date: string): Promise<number>;
  guessCountToday(playerId: string, date: string): Promise<number>;

  boardToday(date: string, limit: number): Promise<TodayRow[]>;
  boardAllTime(limit: number): Promise<AllTimeRow[]>;

  listComments(limit: number): Promise<CommentRow[]>;
  insertComment(row: { id: string; player_id: string; body: string; created_at: string }): Promise<void>;
}

export class MemoryStore implements Store {
  pairs = new Map<string, PairRecord>();
  players = new Map<string, PlayerRecord>();
  playersByNorm = new Map<string, string>();
  guesses = new Map<string, GuessRecord>();

  async getPairById(id: string): Promise<PairRecord | null> {
    return this.pairs.get(id) ?? null;
  }
  async listPairsForDate(date: string): Promise<PairRecord[]> {
    return [...this.pairs.values()]
      .filter((p) => p.play_date === date)
      .sort((a, b) => a.day_index - b.day_index);
  }
  async insertPair(pair: PairRecord): Promise<void> {
    this.pairs.set(pair.id, pair);
  }
  async getPlayer(id: string): Promise<PlayerRecord | null> {
    return this.players.get(id) ?? null;
  }
  async getPlayerByNorm(norm: string): Promise<PlayerRecord | null> {
    const id = this.playersByNorm.get(norm);
    return id ? (this.players.get(id) ?? null) : null;
  }
  async insertPlayer(player: PlayerRecord): Promise<"ok" | "conflict"> {
    if (this.playersByNorm.has(player.username_norm)) return "conflict";
    this.players.set(player.id, { ...player });
    this.playersByNorm.set(player.username_norm, player.id);
    return "ok";
  }
  async updatePlayer(id: string, patch: { avatar?: string; score_total?: number }): Promise<void> {
    const p = this.players.get(id);
    if (!p) return;
    Object.assign(p, patch);
  }
  async getGuess(playerId: string, pairId: string): Promise<GuessRecord | null> {
    return this.guesses.get(`${playerId}:${pairId}`) ?? null;
  }
  async insertGuess(guess: GuessRecord): Promise<"ok" | "conflict"> {
    const key = `${guess.player_id}:${guess.pair_id}`;
    if (this.guesses.has(key)) return "conflict";
    this.guesses.set(key, guess);
    return "ok";
  }
  async listGuessedPairIds(playerId: string, date: string): Promise<string[]> {
    const ids: string[] = [];
    for (const g of this.guesses.values()) {
      if (g.player_id === playerId && g.play_date === date) ids.push(g.pair_id);
    }
    return ids;
  }
  async todayScore(playerId: string, date: string): Promise<number> {
    let n = 0;
    for (const g of this.guesses.values()) {
      if (g.player_id === playerId && g.play_date === date && g.correct) n += 1;
    }
    return n;
  }
  async guessCountToday(playerId: string, date: string): Promise<number> {
    let n = 0;
    for (const g of this.guesses.values()) {
      if (g.player_id === playerId && g.play_date === date) n += 1;
    }
    return n;
  }
  async boardToday(date: string, limit: number): Promise<TodayRow[]> {
    const byPlayer = new Map<string, number>();
    for (const g of this.guesses.values()) {
      if (g.play_date !== date) continue;
      if (!byPlayer.has(g.player_id)) byPlayer.set(g.player_id, 0);
      if (g.correct) byPlayer.set(g.player_id, (byPlayer.get(g.player_id) ?? 0) + 1);
    }
    const rows: TodayRow[] = [];
    for (const [id, scoreToday] of byPlayer) {
      const p = this.players.get(id);
      if (!p) continue;
      rows.push({ username: p.username_display, avatar: p.avatar, scoreToday });
    }
    rows.sort((a, b) => b.scoreToday - a.scoreToday || a.username.localeCompare(b.username));
    return rows.slice(0, limit);
  }
  async boardAllTime(limit: number): Promise<AllTimeRow[]> {
    const rows = [...this.players.values()].map((p) => ({
      username: p.username_display,
      avatar: p.avatar,
      scoreTotal: p.score_total,
    }));
    rows.sort((a, b) => b.scoreTotal - a.scoreTotal || a.username.localeCompare(b.username));
    return rows.slice(0, limit);
  }

  comments: Array<{ id: string; player_id: string; body: string; created_at: string }> = [];

  async listComments(limit: number): Promise<CommentRow[]> {
    const rows = [...this.comments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
    const out: CommentRow[] = [];
    for (const c of rows) {
      const p = this.players.get(c.player_id);
      if (!p) continue;
      out.push({
        id: c.id,
        username: p.username_display,
        avatar: p.avatar,
        body: c.body,
        created_at: c.created_at,
      });
    }
    return out;
  }

  async insertComment(row: { id: string; player_id: string; body: string; created_at: string }): Promise<void> {
    this.comments.push(row);
  }
}
