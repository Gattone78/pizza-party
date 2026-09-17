import { distXZ, vec3, type Vec3 } from '../core/vec';
import type { Draggable } from './Draggable';
import type { DropZone } from './DropZone';

export type DropResult =
  | { readonly kind: 'zone'; readonly zone: DropZone; readonly landAt: Vec3 }
  | { readonly kind: 'home' };

/**
 * Decide where a released draggable goes. The nearest valid zone whose accept
 * radius contains the release point wins; otherwise it goes home (G1.4).
 */
export function resolveDrop(
  position: Vec3,
  draggable: Pick<Draggable, 'validZones'>,
  zones: readonly DropZone[],
): DropResult {
  let best: DropZone | null = null;
  let bestDistance = Infinity;
  for (const zone of zones) {
    if (!draggable.validZones.includes(zone.id)) continue;
    const d = distXZ(position, zone.center);
    if (d <= zone.acceptRadius && d < bestDistance) {
      best = zone;
      bestDistance = d;
    }
  }
  if (!best) return { kind: 'home' };

  // A near miss is pulled in along the line to the centre.
  const pull = bestDistance > best.landRadius ? best.landRadius / bestDistance : 1;
  const landAt = vec3(
    best.center.x + (position.x - best.center.x) * pull,
    best.surfaceY,
    best.center.z + (position.z - best.center.z) * pull,
  );
  return { kind: 'zone', zone: best, landAt };
}
