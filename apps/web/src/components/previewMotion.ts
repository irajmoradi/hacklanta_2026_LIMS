const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Shared by wardrobe and showcase. Angles are radians; time is monotonic ms. */
export class PreviewMotion {
  yaw = 0; pitch = 0; zoom = 1;
  vx = 0; vy = 0; idleAt = 0;
  pointers = new Map<number, { x: number; y: number }>();
  down(id: number, x: number, y: number, now: number) {
    this.pointers.set(id, { x, y }); this.vx = this.vy = 0; this.idleAt = now;
  }
  move(id: number, x: number, y: number, now: number) {
    const previous = this.pointers.get(id); if (!previous) return;
    const other = [...this.pointers.entries()].find(([key]) => key !== id)?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(x - other.x, y - other.y);
      if (before > 0) this.zoom = clamp(this.zoom * after / before, 0.7, 1.5);
    } else {
      this.vx = (x - previous.x) * 0.008; this.vy = (y - previous.y) * 0.005;
      this.yaw += this.vx; this.pitch = clamp(this.pitch + this.vy, -0.35, 0.35);
    }
    this.pointers.set(id, { x, y }); this.idleAt = now;
  }
  up(id: number, now: number) { this.pointers.delete(id); this.idleAt = now; }
  wheel(delta: number, now: number) { this.zoom = clamp(this.zoom * Math.exp(-delta * 0.001), 0.7, 1.5); this.idleAt = now; }
  reset(now: number) { this.yaw = this.pitch = this.vx = this.vy = 0; this.zoom = 1; this.idleAt = now; }
  frame(delta: number, now: number, reduced: boolean) {
    if (this.pointers.size) return;
    const frames = Math.min(delta, 0.05) * 60;
    const decay = Math.pow(0.9, frames);
    this.yaw += this.vx * (1 - decay) / 0.1;
    this.pitch = clamp(this.pitch + this.vy * (1 - decay) / 0.1, -0.35, 0.35);
    this.vx *= decay; this.vy *= decay;
    if (!reduced && now - this.idleAt >= 4000) this.yaw += Math.min(delta, 0.05) * 0.45;
  }
}
