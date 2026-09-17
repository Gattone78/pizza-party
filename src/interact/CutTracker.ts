/**
 * Cutting logic (G3.1 to G3.4), in coordinates local to the pizza centre.
 * `cuts` straight cuts through the centre give `2 * cuts` equal slices.
 */
export interface Point2 {
  readonly x: number;
  readonly z: number;
}

/** Angle of guide line `index`, measured from +x towards +z. */
export const guideAngle = (index: number, cuts: number): number => (index * Math.PI) / cuts;

export const sliceCount = (cuts: number): number => cuts * 2;

/** Slice `i` spans the angles between guide lines `i` and `i + 1`. */
export function sliceSpan(index: number, cuts: number): { from: number; to: number } {
  const step = Math.PI / cuts;
  return { from: index * step, to: (index + 1) * step };
}

export function sliceIndexForPoint(p: Point2, cuts: number): number {
  const angle = (Math.atan2(p.z, p.x) + Math.PI * 2) % (Math.PI * 2);
  return Math.min(sliceCount(cuts) - 1, Math.floor(angle / (Math.PI / cuts)));
}

/** How far a slice has parted from the centre, given which cuts have been made (G3.4). */
export function sliceOffset(
  index: number,
  cuts: number,
  completed: ReadonlySet<number>,
  gap: number,
): Point2 {
  const { from, to } = sliceSpan(index, cuts);
  const mid = (from + to) / 2;
  let x = 0;
  let z = 0;
  for (const guide of completed) {
    const a = guideAngle(guide, cuts);
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    const side = Math.sign(Math.cos(mid) * nx + Math.sin(mid) * nz);
    x += nx * side * gap;
    z += nz * side * gap;
  }
  return { x, z };
}

export interface CutTrackerOptions {
  /** How far from a guide line still counts as "roughly near" (G3.2). */
  readonly tolerance: number;
  /** Fraction of the diameter a pass must cover along the guide. */
  readonly requiredSpan: number;
  /** A swipe at least this long over the pizza always cuts something. */
  readonly minSwipe: number;
}

interface GuideProgress {
  min: number;
  max: number;
}

/**
 * Turns wheel movement into completed cuts. Forgiving by design: progress
 * along a guide accumulates across strokes, and any decent swipe across the
 * pizza that matched no guide still snaps to the closest remaining one, so
 * every swipe does something (P1, P3).
 */
export class CutTracker {
  readonly completed = new Set<number>();
  private readonly progress: GuideProgress[];
  private readonly options: CutTrackerOptions;
  private strokeStart: Point2 | null = null;
  private last: Point2 | null = null;
  private strokeLength = 0;
  private strokeCut = false;

  constructor(
    readonly cuts: number,
    readonly radius: number,
    options: Partial<CutTrackerOptions> = {},
  ) {
    this.options = { tolerance: radius * 0.42, requiredSpan: 0.55, minSwipe: radius, ...options };
    this.progress = Array.from({ length: cuts }, () => ({ min: Infinity, max: -Infinity }));
  }

  get done(): boolean {
    return this.completed.size >= this.cuts;
  }

  /** Feed the wheel position. Returns the guides completed by this movement. */
  track(p: Point2): number[] {
    const overPizza = Math.hypot(p.x, p.z) <= this.radius;
    if (overPizza) {
      if (this.last) this.strokeLength += Math.hypot(p.x - this.last.x, p.z - this.last.z);
      else this.strokeStart = p;
      this.last = p;
    }

    const finished: number[] = [];
    this.progress.forEach((progress, index) => {
      if (this.completed.has(index)) return;
      const a = guideAngle(index, this.cuts);
      const along = p.x * Math.cos(a) + p.z * Math.sin(a);
      const across = Math.abs(-p.x * Math.sin(a) + p.z * Math.cos(a));
      if (across > this.options.tolerance || Math.abs(along) > this.radius * 1.15) return;
      progress.min = Math.min(progress.min, along);
      progress.max = Math.max(progress.max, along);
      if (progress.max - progress.min >= this.options.requiredSpan * this.radius * 2) {
        this.completed.add(index);
        finished.push(index);
        this.strokeCut = true;
      }
    });
    return finished;
  }

  /** End of a stroke. Returns a guide completed by the forgiving fallback, or null. */
  endStroke(): number | null {
    const start = this.strokeStart;
    const end = this.last;
    const eligible = !this.strokeCut && this.strokeLength >= this.options.minSwipe && !this.done;
    this.strokeStart = null;
    this.last = null;
    this.strokeLength = 0;
    this.strokeCut = false;
    if (!eligible || !start || !end) return null;

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    let best: number | null = null;
    let bestAlignment = -1;
    for (let index = 0; index < this.cuts; index++) {
      if (this.completed.has(index)) continue;
      const a = guideAngle(index, this.cuts);
      const alignment = Math.abs(dx * Math.cos(a) + dz * Math.sin(a));
      if (alignment > bestAlignment) {
        best = index;
        bestAlignment = alignment;
      }
    }
    if (best !== null) this.completed.add(best);
    return best;
  }
}
