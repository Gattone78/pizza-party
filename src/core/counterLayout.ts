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

/** Grab targets (bowls) at scale 1, and how their far edge is anchored. */
export const BOWL_RADIUS = 0.55;
export const BOWL_FAR_EDGE_Z = -1.45;
export const MAX_TARGET_SCALE = 1.6;

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

/**
 * Everything interactive stays inside this rectangle on the counter, and the
 * camera frames exactly this. The near edge moves out as the bowls scale up.
 */
export function playArea(targetScale: number): PlayArea {
  return {
    minX: -3.2,
    maxX: 3.2,
    minZ: BOWL_FAR_EDGE_Z - BOWL_RADIUS * 2 * targetScale - 0.2,
    maxZ: PIZZA_CENTER.z + PIZZA_RADIUS + 0.2,
  };
}

/** Bowl centre for a data-defined slot, given the current target scale. */
export function bowlPosition(slotX: number, arcZ: number, targetScale: number): Vec3 {
  return vec3(slotX, 0, BOWL_FAR_EDGE_Z - BOWL_RADIUS * targetScale + arcZ);
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

  // Bigger bowls need a bigger play area, which pushes the camera back and
  // shrinks them again, so settle the scale over a few rounds.
  let targetScale = 1;
  let rig = fitRig(aspect, playArea(targetScale));
  for (let i = 0; i < 6; i++) {
    // Measure where the bowl furthest from the camera (smallest on screen) sits.
    const reference = vec3(0, 0, BOWL_FAR_EDGE_Z + 0.5);
    const px = worldLengthToPx(rig, reference, BOWL_RADIUS * 2 * targetScale, viewport.height);
    if (px >= MIN_TARGET_PX || targetScale >= MAX_TARGET_SCALE) break;
    targetScale = clamp((targetScale * MIN_TARGET_PX * 1.03) / px, 1, MAX_TARGET_SCALE);
    rig = fitRig(aspect, playArea(targetScale));
  }

  return { viewport, aspect, rig, targetScale };
}
