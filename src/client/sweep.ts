import type { GuessResponse, Pair, Side } from "./types.js";

export type Spring = { x: number; v: number };

/** Critically damped spring. omega ≈ 11 settles in ~0.4s with no bounce. */
export function stepSpring(state: Spring, target: number, dt: number, omega = 11): Spring {
  const accel = -2 * omega * state.v - omega * omega * (state.x - target);
  const v = state.v + accel * dt;
  const x = state.x + v * dt;
  return { x, v };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function settled(state: Spring, target: number): boolean {
  return Math.abs(state.x - target) < 0.004 && Math.abs(state.v) < 0.02;
}

export function animateSpring(
  from: number,
  to: number,
  apply: (x: number) => void,
  omega = 11,
): Promise<void> {
  if (prefersReducedMotion()) {
    apply(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let state: Spring = { x: from, v: 0 };
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.008, (now - last) / 1000));
      last = now;
      state = stepSpring(state, to, dt, omega);
      apply(state.x);
      if (settled(state, to)) {
        apply(to);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    apply(from);
    requestAnimationFrame(tick);
  });
}

export type SweepHandles = {
  desk: HTMLElement;
  pair: HTMLElement;
  cut: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
  topic: HTMLElement;
  leftText: HTMLElement;
  rightText: HTMLElement;
  leftMark: HTMLElement;
  rightMark: HTMLElement;
  tell: HTMLElement;
};

function setCut(cut: HTMLElement, t: number): void {
  // t = 0 center blade; -1 covers the chosen card; ±2 is off-stage.
  const pairW = cut.parentElement?.clientWidth ?? 640;
  const abs = Math.abs(t);
  const cover = Math.min(1, abs);
  const dir = t < 0 ? -1 : t > 0 ? 1 : 0;
  const blade = 16;
  const width = blade + cover * (pairW * 0.48 - blade);
  const mid = pairW / 2;
  const cardCenter = dir < 0 ? pairW * 0.25 : pairW * 0.75;
  const extra = Math.max(0, abs - 1);
  const x = mid + dir * cover * (Math.abs(cardCenter - mid)) + dir * extra * pairW;
  const tilt = dir * cover * 2.4 + dir * extra * 1.2;
  cut.style.width = `${Math.max(blade, width)}px`;
  cut.style.left = `${x}px`;
  cut.style.transform = `translateX(-50%) rotate(${tilt}deg)`;
  cut.style.opacity = extra > 0.8 ? String(Math.max(0, 1.6 - extra * 1.4)) : "1";
  cut.setAttribute("data-dir", t < 0 ? "left" : t > 0 ? "right" : "mid");
}

export class Sweep {
  private handles: SweepHandles;
  private cutX = 0;

  constructor(handles: SweepHandles) {
    this.handles = handles;
    setCut(handles.cut, 0);
  }

  lean(side: Side | null): void {
    if (prefersReducedMotion()) return;
    const target = side === "left" ? -0.08 : side === "right" ? 0.08 : 0;
    setCut(this.handles.cut, target);
    this.cutX = target;
    this.handles.left.classList.toggle("is-lean", side === "left");
    this.handles.right.classList.toggle("is-lean", side === "right");
  }

  press(side: Side): void {
    const press = side === "left" ? -0.22 : 0.22;
    setCut(this.handles.cut, press);
    this.cutX = press;
    const card = side === "left" ? this.handles.left : this.handles.right;
    this.handles.left.classList.remove("is-lean");
    this.handles.right.classList.remove("is-lean");
    card.classList.add("is-pressed", "is-picking");
  }

  async resolve(side: Side, result: GuessResponse): Promise<void> {
    const { left, right, leftMark, rightMark, tell, pair, desk, cut } = this.handles;
    const chosen = side === "left" ? left : right;
    left.classList.toggle("is-human", result.humanSide === "left");
    right.classList.toggle("is-human", result.humanSide === "right");
    left.classList.toggle("is-ai", result.humanSide !== "left");
    right.classList.toggle("is-ai", result.humanSide !== "right");
    leftMark.textContent = result.humanSide === "left" ? "Human" : "AI";
    rightMark.textContent = result.humanSide === "right" ? "Human" : "AI";
    leftMark.hidden = false;
    rightMark.hidden = false;
    leftMark.classList.remove("is-in");
    rightMark.classList.remove("is-in");
    void leftMark.offsetWidth;
    leftMark.classList.add("is-in");
    rightMark.classList.add("is-in");
    tell.hidden = false;
    tell.textContent = [
      result.correct ? "You found the human." : "That one was written by a machine.",
      result.tell,
      result.source ? `Source · ${result.source}` : "",
      result.model ? `Model · ${result.model}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (result.correct) {
      chosen.classList.add("is-hit");
    } else {
      chosen.classList.add("is-miss");
    }

    const cover = side === "left" ? -1 : 1;
    if (prefersReducedMotion()) {
      setCut(cut, cover);
      await wait(160);
      return;
    }

    await wait(240);
    await animateSpring(this.cutX, cover, (x) => {
      this.cutX = x;
      setCut(cut, x);
    }, 9.2);
    const off = side === "left" ? -2.15 : 2.15;
    await Promise.all([
      animateSpring(this.cutX, off, (x) => {
        this.cutX = x;
        setCut(cut, x);
      }, 9),
      animateSpring(0, side === "left" ? -1.05 : 1.05, (x) => {
        pair.style.transform = `translateX(${x * 100}%) rotate(${x * -1.4}deg)`;
      }, 9),
    ]);
    desk.style.opacity = "1";
  }

  async deal(pair: Pair): Promise<void> {
    const h = this.handles;
    h.left.classList.remove("is-pressed", "is-picking", "is-hit", "is-miss", "is-human", "is-ai", "is-lean");
    h.right.classList.remove("is-pressed", "is-picking", "is-hit", "is-miss", "is-human", "is-ai", "is-lean");
    h.leftMark.hidden = true;
    h.rightMark.hidden = true;
    h.leftMark.classList.remove("is-in");
    h.rightMark.classList.remove("is-in");
    h.tell.hidden = true;
    h.tell.textContent = "";
    h.topic.textContent = pair.topic;
    h.leftText.textContent = pair.left;
    h.rightText.textContent = pair.right;
    h.leftMark.textContent = "";
    h.rightMark.textContent = "";
    this.cutX = 0;
    setCut(h.cut, 0);

    if (prefersReducedMotion()) {
      h.pair.style.transform = "translateX(0)";
      h.desk.style.opacity = "1";
      return;
    }

    h.pair.style.transform = "translateX(108%) rotate(1.6deg)";
    h.desk.style.opacity = "1";
    await animateSpring(1.08, 0, (x) => {
      h.pair.style.transform = `translateX(${x * 100}%) rotate(${x * 1.6}deg)`;
    }, 9.4);
    h.pair.style.transform = "translateX(0)";
  }
}
