import type { Vec3 } from '../core/vec';

/** A circular snap target on the counter plane. */
export interface DropZone {
  readonly id: string;
  readonly center: Vec3;
  /** A release within this radius counts. Wider than the visible object (P3). */
  readonly acceptRadius: number;
  /** Landing points are pulled inside this radius so nothing hangs off the edge. */
  readonly landRadius: number;
  /** Height at which a landed piece rests. */
  readonly surfaceY: number;
  /** How many pieces the zone holds, e.g. 1 for a plate. Unlimited if omitted. */
  readonly capacity?: number;
}
