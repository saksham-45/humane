export function scoreLine(correct: boolean, streak: number | null): string {
  if (correct) return `Streak ${streak ?? 1}`;
  return "Streak reset";
}

export function verdictLine(correct: boolean): string {
  return correct ? "You found the human." : "That one was written by a machine.";
}
