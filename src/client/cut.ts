import { Spring } from "./spring.ts";

export interface CutOpts {
  stage: HTMLElement;
  cut: HTMLElement;
  reduced: boolean;
}

/**
 * Thin torn cut. Press slides it toward the chosen side on a critically
 * damped spring, then settle() parks it so both cards stay readable.
 * Never expands into a cover. Interruptible: retarget keeps x,v.
 */
export class CutMotion {
  private readonly pos: Spring;
  private readonly fat: Spring;
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
    this.pos = new Spring(0.5, 0.4, 1);
    this.fat = new Spring(0, 0.32, 1);
    this.stacked = window.matchMedia("(max-width: 720px)").matches;
    this.paint();
  }

  get value(): number {
    return this.pos.x;
  }

  /** Press: slide toward that side immediately. Does not wait for release. */
  press(side: "left" | "right"): void {
    const next = side === "left" ? 0.4 : 0.6;
    if (this.reduced) {
      this.pos.snap(next);
      this.fat.snap(1);
      this.paint();
      return;
    }
    this.pos.setTarget(next);
    this.fat.setTarget(1);
    this.kick();
  }

  /** After the pick lands: keep the bias, shrink so both texts stay clear. */
  settle(): void {
    const toward = this.pos.target < 0.5 ? 0.46 : this.pos.target > 0.5 ? 0.54 : 0.5;
    if (this.reduced) {
      this.pos.snap(toward);
      this.fat.snap(0);
      this.paint();
      return;
    }
    this.pos.setTarget(toward);
    this.fat.setTarget(0);
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
      this.fat.step(dt);
      this.paint();
      if (this.pos.settled && this.fat.settled) {
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
    const width = rest + this.fat.x * 18;
    if (this.stacked) {
      const top = this.pos.x * H - width / 2;
      this.cut.style.left = "0";
      this.cut.style.width = "100%";
      this.cut.style.top = `${top}px`;
      this.cut.style.height = `${width}px`;
    } else {
      const left = this.pos.x * W - width / 2;
      this.cut.style.top = "0";
      this.cut.style.height = "100%";
      this.cut.style.left = `${left}px`;
      this.cut.style.width = `${width}px`;
    }
    const t = this.pos.x;
    this.stage.dataset.cover = t < 0.45 ? "left" : t > 0.55 ? "right" : "center";
  }
}
