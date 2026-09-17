import { vec3, type Vec3 } from './vec';

/**
 * The fixed counter camera (T1), described without Babylon so ray-to-counter
 * picking and hit-target sizing can be unit tested. Left-handed, y up: the
 * camera sits on the -z side of `target`, pitched down by `pitch` radians,
 * with a vertical field of view of `fovY` radians.
 */
export interface CameraRig {
  readonly target: Vec3;
  readonly pitch: number;
  readonly fovY: number;
  readonly distance: number;
}

export interface Ndc {
  /** -1 (left) to 1 (right). */
  readonly x: number;
  /** -1 (bottom) to 1 (top). */
  readonly y: number;
  /** Distance along the view direction, in world units. */
  readonly depth: number;
}

const forwardOf = (pitch: number): Vec3 => vec3(0, -Math.sin(pitch), Math.cos(pitch));
const upOf = (pitch: number): Vec3 => vec3(0, Math.cos(pitch), Math.sin(pitch));

export function cameraPosition(rig: CameraRig): Vec3 {
  const f = forwardOf(rig.pitch);
  return vec3(
    rig.target.x - f.x * rig.distance,
    rig.target.y - f.y * rig.distance,
    rig.target.z - f.z * rig.distance,
  );
}

export function projectToNdc(rig: CameraRig, aspect: number, p: Vec3): Ndc {
  const pos = cameraPosition(rig);
  const f = forwardOf(rig.pitch);
  const u = upOf(rig.pitch);
  const vx = p.x - pos.x;
  const vy = p.y - pos.y;
  const vz = p.z - pos.z;
  const depth = vx * f.x + vy * f.y + vz * f.z;
  const tan = Math.tan(rig.fovY / 2);
  return {
    x: vx / (depth * tan * aspect),
    y: (vy * u.y + vz * u.z) / (depth * tan),
    depth,
  };
}

/**
 * Where the ray through a screen point meets the horizontal plane y = planeY.
 * Returns null if the ray points at or above the horizon.
 */
export function screenToPlane(
  rig: CameraRig,
  aspect: number,
  ndcX: number,
  ndcY: number,
  planeY = 0,
): Vec3 | null {
  const pos = cameraPosition(rig);
  const f = forwardOf(rig.pitch);
  const u = upOf(rig.pitch);
  const tan = Math.tan(rig.fovY / 2);
  const dx = ndcX * tan * aspect;
  const dy = f.y + u.y * ndcY * tan;
  const dz = f.z + u.z * ndcY * tan;
  if (dy >= -1e-6) return null;
  const t = (planeY - pos.y) / dy;
  return vec3(pos.x + dx * t, planeY, pos.z + dz * t);
}

/** Smallest camera distance at which every point sits inside `margin` of the screen edge. */
export function fitDistance(
  rig: Omit<CameraRig, 'distance'>,
  aspect: number,
  points: readonly Vec3[],
  margin = 0.92,
): number {
  const fits = (distance: number): boolean =>
    points.every((p) => {
      const n = projectToNdc({ ...rig, distance }, aspect, p);
      return n.depth > 0 && Math.abs(n.x) <= margin && Math.abs(n.y) <= margin;
    });
  let lo = 0.5;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** On-screen size in CSS px of a horizontal world length centred at `at`. */
export function worldLengthToPx(
  rig: CameraRig,
  at: Vec3,
  length: number,
  viewportHeightPx: number,
): number {
  const { depth } = projectToNdc(rig, 1, at);
  return (length / (depth * Math.tan(rig.fovY / 2))) * (viewportHeightPx / 2);
}
