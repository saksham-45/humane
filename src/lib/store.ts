import type { GuessRecord, PairRecord, PlayerRecord, Side } from "../types.ts";

export interface BoardEntry {
  username_display: string;
  current_streak: number;
  longest_streak: number;
  player_id: string;
  today_correct_at: string | null;
}

export interface Store {
  getPair(date: string): Promise<PairRecord | null>;
  listPairDates(): Promise<string[]>;
  insertPair(pair: PairRecord): Promise<void>;
  pairCount(): Promise<number>;

  getPlayer(id: string): Promise<PlayerRecord | null>;
  getPlayerByNorm(norm: string): Promise<PlayerRecord | null>;
  insertPlayer(player: PlayerRecord): Promise<"ok" | "conflict">;
  updatePlayerStreak(
    id: string,
    patch: {
      current_streak: number;
      longest_streak: number;
      last_play_date: string;
      last_result: string;
    },
  ): Promise<void>;
  playerCount(): Promise<number>;

  getGuess(playerId: string, date: string): Promise<GuessRecord | null>;
  insertGuess(guess: GuessRecord): Promise<"ok" | "conflict">;

  board(date: string, limit: number): Promise<BoardEntry[]>;
  rankOf(playerId: string, date: string): Promise<{ rank: number; row: BoardEntry } | null>;

  getAnonGuess(sessionId: string, date: string): Promise<{ side: Side; correct: boolean } | null>;
  putAnonGuess(sessionId: string, date: string, side: Side, correct: boolean): Promise<void>;
}

export class MemoryStore implements Store {
  pairs = new Map<string, PairRecord>();
  players = new Map<string, PlayerRecord>();
  playersByNorm = new Map<string, string>();
  guesses = new Map<string, GuessRecord>();
  anon = new Map<string, { side: Side; correct: boolean }>();

  async getPair(date: string): Promise<PairRecord | null> {
    for (const p of this.pairs.values()) if (p.play_date === date) return p;
    return null;
  }
  async listPairDates(): Promise<string[]> {
    return [...this.pairs.values()].map((p) => p.play_date).sort();
  }
  async insertPair(pair: PairRecord): Promise<void> {
    this.pairs.set(pair.id, pair);
  }
  async pairCount(): Promise<number> {
    return this.pairs.size;
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
  async updatePlayerStreak(
    id: string,
    patch: {
      current_streak: number;
      longest_streak: number;
      last_play_date: string;
      last_result: string;
    },
  ): Promise<void> {
    const p = this.players.get(id);
    if (!p) return;
    Object.assign(p, patch);
  }
  async playerCount(): Promise<number> {
    return this.players.size;
  }
  async getGuess(playerId: string, date: string): Promise<GuessRecord | null> {
    return this.guesses.get(`${playerId}:${date}`) ?? null;
  }
  async insertGuess(guess: GuessRecord): Promise<"ok" | "conflict"> {
    const key = `${guess.player_id}:${guess.play_date}`;
    if (this.guesses.has(key)) return "conflict";
    this.guesses.set(key, guess);
    return "ok";
  }
  async board(date: string, limit: number): Promise<BoardEntry[]> {
    return ranked(this, date).slice(0, limit);
  }
  async rankOf(playerId: string, date: string): Promise<{ rank: number; row: BoardEntry } | null> {
    const rows = ranked(this, date);
    const idx = rows.findIndex((r) => r.player_id === playerId);
    if (idx < 0) return null;
    return { rank: idx + 1, row: rows[idx] };
  }
  async getAnonGuess(sessionId: string, date: string): Promise<{ side: Side; correct: boolean } | null> {
    return this.anon.get(`${sessionId}:${date}`) ?? null;
  }
  async putAnonGuess(sessionId: string, date: string, side: Side, correct: boolean): Promise<void> {
    this.anon.set(`${sessionId}:${date}`, { side, correct });
  }
}

function ranked(store: MemoryStore, date: string): BoardEntry[] {
  const rows: BoardEntry[] = [];
  for (const p of store.players.values()) {
    const g = store.guesses.get(`${p.id}:${date}`);
    rows.push({
      username_display: p.username_display,
      current_streak: p.current_streak,
      longest_streak: p.longest_streak,
      player_id: p.id,
      today_correct_at: g && g.correct ? g.created_at : null,
    });
  }
  rows.sort((a, b) => {
    if (b.current_streak !== a.current_streak) return b.current_streak - a.current_streak;
    if (b.longest_streak !== a.longest_streak) return b.longest_streak - a.longest_streak;
    if (a.today_correct_at && b.today_correct_at) return a.today_correct_at.localeCompare(b.today_correct_at);
    if (a.today_correct_at) return -1;
    if (b.today_correct_at) return 1;
    return a.username_display.localeCompare(b.username_display);
  });
  return rows;
}
