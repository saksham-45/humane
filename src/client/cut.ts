import { CUT_PRESS_LEFT, CUT_PRESS_RIGHT, CUT_SETTLE, CUT_TRAVEL, cutShift } from "../lib/cut-layout.ts";
import { Spring } from "./spring.ts";

export interface CutOpts {
  stage: HTMLElement;
  cut: HTMLElement;
  reduced: boolean;
}

/**
 * Thin center divider. Press slides it a few pixels toward the pick.
 * settle() always returns it to the gutter so both cards stay fully readable.
 */
export class CutMotion {
  private readonly pos: Spring;
  private readonly stage: HTMLElement;
  private readonly cut: HTMLElement;
  private readonly reduced: boolean;
  private raf = 0;
  private last = 0;
  private stacked = false;

  constructor(opts: CutOpts) {
    this.stage = opts.stage;
    this.cut = opts.cut;
    this.reduced = opts.reduced;
    this.pos = new Spring(CUT_SETTLE, 0.4, 1);
    this.stacked = window.matchMedia("(max-width: 720px)").matches;
    this.clearLegacyBox();
    this.paint();
  }

  get value(): number {
    return this.pos.x;
  }

  press(side: "left" | "right"): void {
    const next = side === "left" ? CUT_PRESS_LEFT : CUT_PRESS_RIGHT;
    if (this.reduced) {
      this.pos.snap(next);
      this.paint();
      return;
    }
    this.pos.setTarget(next);
    this.kick();
  }

  settle(): void {
    if (this.reduced) {
      this.pos.snap(CUT_SETTLE);
      this.paint();
      return;
    }
    this.pos.setTarget(CUT_SETTLE);
    this.kick();
  }

  setStacked(stacked: boolean): void {
    this.stacked = stacked;
    this.paint();
  }

  private kick(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - this.last) / 1000);
      this.last = now;
      this.pos.step(dt);
      this.paint();
      if (this.pos.settled) {
        this.raf = 0;
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private clearLegacyBox(): void {
    this.cut.style.left = "";
    this.cut.style.right = "";
    this.cut.style.top = "";
    this.cut.style.width = "";
    this.cut.style.height = "";
  }

  private paint(): void {
    this.clearLegacyBox();
    const shift = cutShift(this.pos.x, CUT_TRAVEL);
    this.cut.style.transform = this.stacked ? `translateY(${shift}px)` : `translateX(${shift}px)`;
    const t = this.pos.x;
    this.stage.dataset.cover = t < -0.2 ? "left" : t > 0.2 ? "right" : "center";
  }
}
