export type Side = "left" | "right";

export type Pair = {
  id: string;
  topic: string;
  left: string;
  right: string;
};

export type Me = {
  username: string;
  avatar: string;
  date: string;
  scoreToday: number;
  scoreTotal: number;
  round: number;
  of: 5;
  doneToday: boolean;
};

export type NextDone = {
  done: true;
  scoreToday: number;
  scoreTotal: number;
  unclaimed?: boolean;
};

export type NextResponse = Pair | NextDone;

export type GuessResponse = {
  correct: boolean;
  humanSide: Side;
  tell: string;
  source: string;
  model: string;
  pointsDelta: number;
  scoreToday: number;
  scoreTotal: number;
  round: number;
  of: 5;
  next: Pair | null;
};

export type BoardRowToday = {
  username: string;
  avatar: string;
  scoreToday: number;
};

export type BoardRowAll = {
  username: string;
  avatar: string;
  scoreTotal: number;
};

export type Board = {
  today: BoardRowToday[];
  alltime: BoardRowAll[];
};

export type Comment = {
  id: string;
  username: string;
  avatar: string;
  body: string;
  created_at: string;
};

export function isNextDone(value: NextResponse): value is NextDone {
  return "done" in value && value.done === true;
}

export function avatarSrc(id: string): string {
  const slug = /^ink-\d{1,2}$/.test(id) ? id : "ink-0";
  return `/avatars/${slug}.gif`;
}
