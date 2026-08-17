import { Spring } from "./spring.ts";

export type Cover = -1 | 0 | 1;
export type StampWord = "HUMAN" | "SIGNAL" | "";

export interface CutOpts {
  stage: HTMLElement;
  cut: HTMLElement;
  stamp: HTMLElement;
  reduced: boolean;
}

/**
 * Physical cut. Cover is a spring on [-1, 1]: 0 center, -1 left/top, +1 right/bottom.
 * Retargeting keeps position and velocity. Never disables input.
 */
export class CutMotion {
  private readonly cover: Spring;
  private readonly stampSpring: Spring;
  private readonly stage: HTMLElement;
  private readonly cut: HTMLElement;
  private readonly stamp: HTMLElement;
  private readonly reduced: boolean;
  private raf = 0;
  private last = 0;
  private stacked = false;
  private word: StampWord = "";

  constructor(opts: CutOpts) {
    this.stage = opts.stage;
    this.cut = opts.cut;
    this.stamp = opts.stamp;
    this.reduced = opts.reduced;
    this.cover = new Spring(0, 0.4, 1);
    this.stampSpring = new Spring(0, 0.32, 1);
    this.stacked = window.matchMedia("(max-width: 720px)").matches;
    this.paint();
  }

  get value(): number {
    return this.cover.x;
  }

  /** Press: retarget immediately. Does not wait for release or settle. */
  press(side: "left" | "right"): void {
    const next: Cover = side === "left" ? -1 : 1;
    if (this.reduced) {
      this.cover.snap(next);
      this.paint();
      return;
    }
    this.cover.setTarget(next);
    this.kick();
  }

  reveal(word: StampWord): void {
    this.word = word;
    this.stamp.textContent = word;
    this.stamp.dataset.word = word.toLowerCase();
    if (this.reduced) {
      this.stampSpring.snap(1);
      this.paint();
      return;
    }
    this.stampSpring.setTarget(1);
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
      this.cover.step(dt);
      this.stampSpring.step(dt);
      this.paint();
      if (this.cover.settled && this.stampSpring.settled) {
        this.raf = 0;
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private paint(): void {
    const box = this.stage.getBoundingClientRect();
    const W = box.width || this.stage.clientWidth;
    const H = box.height || this.stage.clientHeight;
    const rest = this.stacked ? 28 : 40;
    const t = this.cover.x;
    if (this.stacked) {
      const mid = H / 2;
      const width = rest + Math.abs(t) * (H / 2 - rest);
      const top = t >= 0 ? mid - rest / 2 : mid - rest / 2 - Math.abs(t) * (H / 2 - rest / 2);
      this.cut.style.left = "0";
      this.cut.style.width = "100%";
      this.cut.style.top = `${top}px`;
      this.cut.style.height = `${width}px`;
    } else {
      const mid = W / 2;
      const width = rest + Math.abs(t) * (W / 2 - rest);
      const left = t >= 0 ? mid - rest / 2 : mid - rest / 2 - Math.abs(t) * (W / 2 - rest / 2);
      this.cut.style.top = "0";
      this.cut.style.height = "100%";
      this.cut.style.left = `${left}px`;
      this.cut.style.width = `${width}px`;
    }
    this.stage.dataset.cover = t < -0.2 ? "left" : t > 0.2 ? "right" : "center";
    const s = this.stampSpring.x;
    this.stamp.style.opacity = this.reduced ? String(s) : "1";
    const press = this.reduced ? 1 : 0.86 + 0.14 * s;
    const slide = this.reduced ? 0 : (1 - s) * (this.stacked ? 18 : 28);
    const axis = this.stacked ? `translate(-50%, ${slide}px) scale(${press})` : `translate(${slide}px, -50%) scale(${press})`;
    this.stamp.style.transform = axis;
    this.stamp.style.visibility = this.word ? "visible" : "hidden";
  }
}
