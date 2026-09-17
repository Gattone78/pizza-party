import { distXZ, vec3, type Vec3 } from '../core/vec';
import type { Draggable } from './Draggable';
import type { DropZone } from './DropZone';

export type DropResult =
  | { readonly kind: 'zone'; readonly zone: DropZone; readonly landAt: Vec3 }
  | { readonly kind: 'home' };

/**
 * Decide where a released draggable goes. The nearest valid zone whose accept
 * radius contains the release point wins; otherwise it goes home (G1.4).
 * Zones already holding `capacity` pieces are skipped. A drop on a full zone
 * with no free zone in reach goes to the nearest free zone anywhere, so a slice
 * dropped on a taken plate still ends up on a plate (P3).
 */
export function resolveDrop(
  position: Vec3,
  draggable: Pick<Draggable, 'validZones'>,
  zones: readonly DropZone[],
  occupancy?: ReadonlyMap<string, number>,
): DropResult {
  let best: DropZone | null = null;
  let bestDistance = Infinity;
  let nearestFree: DropZone | null = null;
  let nearestFreeDistance = Infinity;
  let onFullZone = false;
  for (const zone of zones) {
    if (!draggable.validZones.includes(zone.id)) continue;
    const d = distXZ(position, zone.center);
    if (zone.capacity !== undefined && (occupancy?.get(zone.id) ?? 0) >= zone.capacity) {
      if (d <= zone.acceptRadius) onFullZone = true;
      continue;
    }
    if (d < nearestFreeDistance) {
      nearestFree = zone;
      nearestFreeDistance = d;
    }
    if (d <= zone.acceptRadius && d < bestDistance) {
      best = zone;
      bestDistance = d;
    }
  }
  if (!best && onFullZone && nearestFree) {
    best = nearestFree;
    bestDistance = nearestFreeDistance;
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
