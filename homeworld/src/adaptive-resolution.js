/** Bounded iPad resolution with slow recovery to avoid visible quality oscillation. */
export class AdaptiveResolution {
  constructor(deviceRatio = 1) {
    this.max = Math.min(Math.max(1, deviceRatio), 1.75);
    this.ratio = Math.min(this.max, 1.5);
    this.reset();
    this.cooldown = 5;
  }
  reset() { this.elapsed = 0; this.frames = 0; this.fast = 0; }
  sample(dt, active = true) {
    // Ignore loading, background tabs and long suspension gaps.
    if (!active || !Number.isFinite(dt) || dt <= 0 || dt > 0.25) {
      this.reset(); this.cooldown = 5; return this.ratio;
    }
    if (this.cooldown > 0) { this.cooldown -= dt; return this.ratio; }
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 3) return this.ratio;
    const average = this.elapsed / this.frames;
    this.fast = average < 0.018 ? this.fast + this.elapsed : 0;
    let next = this.ratio;
    if (average > 0.024) next = Math.max(1, this.ratio - 0.25);
    else if (this.fast >= 12) next = Math.min(this.max, this.ratio + 0.25);
    this.elapsed = 0; this.frames = 0;
    if (next !== this.ratio) { this.ratio = next; this.fast = 0; this.cooldown = 15; }
    return this.ratio;
  }
  forSize(width, height) {
    // Bound the drawing buffer on large iPad Pro screens.
    return Math.min(this.ratio, Math.sqrt(4000000 / Math.max(1, width * height)));
  }
}
