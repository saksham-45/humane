/** Critically damped spring. Response ~0.4s, no bounce. Interruptible: retarget keeps x,v. */

export class Spring {
  x: number;
  v: number;
  target: number;
  readonly omega: number;
  readonly zeta: number;

  constructor(value = 0, response = 0.4, zeta = 1) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.omega = (2 * Math.PI) / response;
    this.zeta = zeta;
  }

  setTarget(next: number): void {
    this.target = next;
  }

  snap(value: number): void {
    this.x = value;
    this.v = 0;
    this.target = value;
  }

  step(dt: number): void {
    const h = Math.min(dt, 1 / 30);
    const k = this.omega * this.omega;
    const c = 2 * this.zeta * this.omega;
    const acc = -k * (this.x - this.target) - c * this.v;
    this.v += acc * h;
    this.x += this.v * h;
  }

  get settled(): boolean {
    return Math.abs(this.x - this.target) < 0.001 && Math.abs(this.v) < 0.02;
  }
}
