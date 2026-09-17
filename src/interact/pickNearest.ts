import { distXZ, type Vec3 } from '../core/vec';

export interface PickCandidate<T> {
  readonly item: T;
  readonly center: Vec3;
  /** Generous: larger than the visible object so a near miss still grabs (P3). */
  readonly pickRadius: number;
}

/** The nearest candidate whose pick radius contains `position`, or null. */
export function pickNearest<T>(
  candidates: readonly PickCandidate<T>[],
  position: Vec3,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = distXZ(position, c.center);
    if (d <= c.pickRadius && d < bestDistance) {
      best = c.item;
      bestDistance = d;
    }
  }
  return best;
}
