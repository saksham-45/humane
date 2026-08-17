/** Press offset on [-1, 1]. Settle is always 0 — a thin center divider. */
export const CUT_PRESS_LEFT = -1;
export const CUT_PRESS_RIGHT = 1;
export const CUT_SETTLE = 0;

/** Max pixels the thin cut may leave the gutter on press. */
export const CUT_TRAVEL = 36;

export function cutShift(pos: number, travel = CUT_TRAVEL): number {
  return pos * travel;
}
