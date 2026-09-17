import type { Vec3 } from '../core/vec';

/** Data-driven drag target definition (X3). */
export interface Draggable {
  readonly id: string;
  /** Where the piece comes from, and returns to when a drop misses. */
  readonly home: Vec3;
  /** Ids of the drop zones that accept this draggable. */
  readonly validZones: readonly string[];
}
