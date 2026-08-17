export type Side = "left" | "right";

export interface PairRecord {
  id: string;
  play_date: string;
  topic: string;
  left_text: string;
  right_text: string;
  human_side: Side;
  human_source: string;
  ai_model: string;
  tell: string;
  created_at: string;
}

export interface PairSource {
  id: string;
  topic: string;
  human: string;
  ai: string;
  human_source: string;
  ai_model: string;
  tell: string;
  play_date: string;
}

export interface PlayerRecord {
  id: string;
  username_norm: string;
  username_display: string;
  created_at: string;
  current_streak: number;
  longest_streak: number;
  last_play_date: string | null;
  last_result: string | null;
}

export interface GuessRecord {
  id: string;
  player_id: string;
  play_date: string;
  picked_side: Side;
  correct: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  playerId: string | null;
}

export interface BoardRow {
  rank: number;
  username: string;
  current: number;
  longest: number;
  you?: boolean;
}

export interface GuessResult {
  correct: boolean;
  humanSide: Side;
  tell: string;
  source: string;
  model: string;
  streak: number | null;
  longest: number | null;
  persisted: boolean;
  already?: boolean;
}

export interface Clock {
  now(): Date;
}

export interface IdGen {
  id(): string;
}
