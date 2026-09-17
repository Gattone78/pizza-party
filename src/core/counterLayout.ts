import { fitDistance, projectToNdc, worldLengthToPx, type CameraRig } from './projection';
import { clamp, vec3, type Vec3 } from './vec';
import type { LandscapeViewport } from './viewport';

/**
 * Counter layout shared by every stage. World units are arbitrary; the
 * counter top is the plane y = 0 and the camera frames a fixed play area.
 */
export const CAMERA_PITCH = (50 * Math.PI) / 180;
export const CAMERA_FOV_Y = 0.5;

export const PIZZA_CENTER: Vec3 = vec3(0, 0, 0.5);
export const PIZZA_RADIUS = 1.6;

/** Grab targets (bowls, tools, the done object) at scale 1. */
export const BOWL_RADIUS = 0.55;
export const MAX_TARGET_SCALE = 1.5;

/** Bowls sit in a column either side of the pizza, like the art reference. */
const COLUMN_X = 3.2;
const COLUMN_Z = [1.55, -0.1, -1.75] as const;

/** Near-side centre: the big "done" object in Toppings, the wheel in Cut. */
export const FRONT_CENTER: Vec3 = vec3(0, 0, -1.9);
/** Left of the pizza: the sauce bottle, then the cheese bowl. */
export const TOOL_HOME: Vec3 = vec3(-COLUMN_X, 0, 0.3);

/**
 * 15 mm (P3, T3) in CSS px. Browsers do not expose physical size, so this
 * assumes the densest target device: an iPhone at about 163 CSS px per inch.
 * Tablets are less dense, so they end up comfortably over 15 mm.
 */
export const MIN_TARGET_PX = 96;

export interface CounterLayout {
  readonly viewport: LandscapeViewport;
  readonly aspect: number;
  readonly rig: CameraRig;
  /** Scale applied to bowls and topping pieces so targets meet MIN_TARGET_PX. */
  readonly targetScale: number;
}

export interface PlayArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Everything interactive stays inside this rectangle, and the camera frames exactly this. */
export const PLAY_AREA: PlayArea = { minX: -4.1, maxX: 4.1, minZ: -2.65, maxZ: 2.4 };

/** Bowl centre for a slot: 0-2 run down the left column, 3-5 down the right. */
export function bowlSlotPosition(slot: number): Vec3 {
  const column = Math.floor(slot / COLUMN_Z.length) % 2;
  const row = slot % COLUMN_Z.length;
  return vec3(column === 0 ? -COLUMN_X : COLUMN_X, 0, COLUMN_Z[row] ?? 0);
}

/** Plate centres for the Plate stage: split between the two side columns. */
export function platePositions(count: number): Vec3[] {
  const perSide = Math.ceil(count / 2);
  const zs = perSide <= 2 ? [1.4, -0.65] : [...COLUMN_Z];
  return Array.from({ length: count }, (_, i) =>
    vec3(i < perSide ? -COLUMN_X : COLUMN_X, 0, zs[i % perSide] ?? 0),
  );
}

/** `count` evenly spaced x positions across the counter, for a row of plates or diners. */
export function rowPositions(count: number, z: number): Vec3[] {
  const span = (PLAY_AREA.maxX - PLAY_AREA.minX) / count;
  return Array.from({ length: count }, (_, i) => vec3(PLAY_AREA.minX + span * (i + 0.5), 0, z));
}

function fitRig(aspect: number, area: PlayArea): CameraRig {
  const corners = [
    vec3(area.minX, 0, area.minZ),
    vec3(area.maxX, 0, area.minZ),
    vec3(area.minX, 0, area.maxZ),
    vec3(area.maxX, 0, area.maxZ),
  ];
  const fit = (targetZ: number): CameraRig => {
    const base = { target: vec3(0, 0, targetZ), pitch: CAMERA_PITCH, fovY: CAMERA_FOV_Y };
    return { ...base, distance: fitDistance(base, aspect, corners) };
  };

  // Perspective makes the near half of the counter taller on screen than the far
  // half, so slide the look-at point until the play area is vertically centred.
  let lo = area.minZ;
  let hi = area.maxZ;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const rig = fit(mid);
    const near = projectToNdc(rig, aspect, vec3(0, 0, area.minZ)).y;
    const far = projectToNdc(rig, aspect, vec3(0, 0, area.maxZ)).y;
    // Content sitting high on screen means the camera should look further away.
    if (near + far > 0) lo = mid;
    else hi = mid;
  }
  return fit((lo + hi) / 2);
}

export function computeLayout(viewport: LandscapeViewport): CounterLayout {
  const aspect = viewport.width / viewport.height;
  const rig = fitRig(aspect, PLAY_AREA);

  // Measure the bowl furthest from the camera, which is the smallest on screen.
  const reference = bowlSlotPosition(0);
  const px = worldLengthToPx(rig, reference, BOWL_RADIUS * 2, viewport.height);
  const targetScale = clamp(MIN_TARGET_PX / px, 1, MAX_TARGET_SCALE);

  return { viewport, aspect, rig, targetScale };
}
