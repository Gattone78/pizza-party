/**
 * Tracks how much of a disc has been painted (G0.2, G0.5). Coordinates are
 * local to the disc centre. Paint outside the disc is ignored (G0.3).
 */
export class CoverageGrid {
  private readonly cells: Uint8Array;
  private readonly inside: Uint8Array;
  private readonly total: number;
  private painted = 0;

  constructor(
    readonly radius: number,
    private readonly resolution = 24,
  ) {
    this.cells = new Uint8Array(resolution * resolution);
    this.inside = new Uint8Array(resolution * resolution);
    let total = 0;
    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        if (Math.hypot(this.cellCenter(i), this.cellCenter(j)) <= radius) {
          this.inside[j * resolution + i] = 1;
          total++;
        }
      }
    }
    this.total = total;
  }

  /** Fraction of the disc painted, 0..1. */
  get coverage(): number {
    return this.painted / this.total;
  }

  /** Paint a round brush dab. Returns true if the dab touches the disc at all. */
  paint(x: number, z: number, brushRadius: number): boolean {
    if (Math.hypot(x, z) > this.radius + brushRadius) return false;
    const size = (this.radius * 2) / this.resolution;
    const from = (v: number): number => Math.max(0, Math.floor((v - brushRadius + this.radius) / size));
    const to = (v: number): number =>
      Math.min(this.resolution - 1, Math.floor((v + brushRadius + this.radius) / size));
    for (let j = from(z); j <= to(z); j++) {
      for (let i = from(x); i <= to(x); i++) {
        const index = j * this.resolution + i;
        if (!this.inside[index] || this.cells[index]) continue;
        if (Math.hypot(this.cellCenter(i) - x, this.cellCenter(j) - z) <= brushRadius) {
          this.cells[index] = 1;
          this.painted++;
        }
      }
    }
    return true;
  }

  reset(): void {
    this.cells.fill(0);
    this.painted = 0;
  }

  private cellCenter(index: number): number {
    return ((index + 0.5) / this.resolution) * this.radius * 2 - this.radius;
  }
}

/**
 * Points from `a` to `b` no more than `step` apart, excluding `a`, so a fast
 * swipe paints a continuous stroke instead of separate dabs.
 */
export function strokePoints(
  a: { x: number; z: number },
  b: { x: number; z: number },
  step: number,
): { x: number; z: number }[] {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  });
}
