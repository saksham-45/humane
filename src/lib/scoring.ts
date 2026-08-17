import { yesterdayOf } from "./date.ts";
import type { PlayerRecord } from "../types.ts";

export interface StreakUpdate {
  current: number;
  longest: number;
  last_result: "correct" | "wrong";
}

export function nextStreak(
  player: Pick<PlayerRecord, "current_streak" | "longest_streak" | "last_play_date" | "last_result">,
  playDate: string,
  correct: boolean,
): StreakUpdate {
  if (!correct) {
    return {
      current: 0,
      longest: player.longest_streak,
      last_result: "wrong",
    };
  }
  const continues =
    player.last_play_date === yesterdayOf(playDate) && player.last_result === "correct";
  const current = continues ? player.current_streak + 1 : 1;
  return {
    current,
    longest: Math.max(player.longest_streak, current),
    last_result: "correct",
  };
}
