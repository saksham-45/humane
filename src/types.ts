export type Side = "left" | "right";

export interface PairSource {
  id: string;
  topic: string;
  human: string;
  ai: string;
  human_source: string;
  ai_model: string;
  tell: string;
  play_date: string;
  day_index?: number;
  slot?: number;
}

export interface PairRecord {
  id: string;
  play_date: string;
  day_index: number;
  topic: string;
  left_text: string;
  right_text: string;
  human_side: Side;
  human_source: string;
  ai_model: string;
  tell: string;
  created_at: string;
}

export interface PlayerRecord {
  id: string;
  username_norm: string;
  username_display: string;
  avatar: string;
  created_at: string;
  score_total: number;
}

export interface GuessRecord {
  id: string;
  player_id: string;
  play_date: string;
  pair_id: string;
  picked_side: Side;
  correct: boolean;
  created_at: string;
}

export interface PublicPair {
  id: string;
  topic: string;
  left: string;
  right: string;
}

export interface Session {
  id: string;
  playerId: string | null;
}

export interface GuessResult {
  correct: boolean;
  humanSide: Side;
  tell: string;
  source: string;
  model: string;
  pointsDelta: number;
  scoreToday: number;
  scoreTotal: number;
  round: number;
  of: number;
  next: PublicPair | null;
}

export interface MeResult {
  username: string | null;
  avatar: string | null;
  date: string;
  scoreToday: number;
  scoreTotal: number;
  round: number;
  of: number;
  doneToday: boolean;
}

export type NextResult =
  | { done: true; scoreToday: number; scoreTotal: number }
  | (PublicPair & { done?: false });

export interface BoardResult {
  today: Array<{ username: string; avatar: string; scoreToday: number }>;
  alltime: Array<{ username: string; avatar: string; scoreTotal: number }>;
}

export interface CommentRow {
  id: string;
  username: string;
  avatar: string;
  body: string;
  created_at: string;
}

export interface Clock {
  now(): Date;
}

export interface IdGen {
  id(): string;
}
