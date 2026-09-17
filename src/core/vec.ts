/** Plain world-space vector so game logic never needs a Babylon import. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 =>
  vec3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

/** Distance on the counter plane, ignoring height. */
export const distXZ = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
