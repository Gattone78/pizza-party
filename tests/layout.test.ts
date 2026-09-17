import { describe, expect, it } from 'vitest';
import {
  BOWL_RADIUS,
  MIN_TARGET_PX,
  PIZZA_CENTER,
  PIZZA_RADIUS,
  bowlPosition,
  computeLayout,
  playArea,
} from '../src/core/counterLayout';
import { projectToNdc, screenToPlane, worldLengthToPx } from '../src/core/projection';
import { distXZ, vec3 } from '../src/core/vec';
import { clientToNdc, landscapeViewport } from '../src/core/viewport';
import toppings from '../src/data/toppings.json';

const devices = {
  'iPhone SE': [667, 375],
  'iPhone 15': [852, 393],
  'iPad 10.9': [1180, 820],
  'iPad Pro 13': [1366, 1024],
  'Android tablet': [1280, 800],
} as const;

describe('projection', () => {
  const layout = computeLayout(landscapeViewport(1180, 820));

  it('round-trips a counter point through the screen', () => {
    const p = vec3(1.3, 0, -2.1);
    const ndc = projectToNdc(layout.rig, layout.aspect, p);
    const back = screenToPlane(layout.rig, layout.aspect, ndc.x, ndc.y)!;
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(0);
    expect(back.z).toBeCloseTo(p.z);
  });

  it('puts the camera target at the centre of the screen', () => {
    const ndc = projectToNdc(layout.rig, layout.aspect, layout.rig.target);
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });
});

describe.each(Object.entries(devices))('layout on %s', (_name, [w, h]) => {
  const layout = computeLayout(landscapeViewport(w, h));

  it('keeps the whole play area on screen', () => {
    const area = playArea(layout.targetScale);
    for (const x of [area.minX, area.maxX]) {
      for (const z of [area.minZ, area.maxZ]) {
        const ndc = projectToNdc(layout.rig, layout.aspect, vec3(x, 0, z));
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('makes every bowl at least 15 mm (96 CSS px) wide', () => {
    for (const t of toppings) {
      const at = bowlPosition(t.bowlX, t.bowlArcZ, layout.targetScale);
      const px = worldLengthToPx(layout.rig, at, BOWL_RADIUS * 2 * layout.targetScale, h);
      expect(px).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
  });

  it('keeps scaled bowls inside the play area and clear of the pizza and each other', () => {
    const r = BOWL_RADIUS * layout.targetScale;
    const area = playArea(layout.targetScale);
    const centres = toppings.map((t) => bowlPosition(t.bowlX, t.bowlArcZ, layout.targetScale));
    centres.forEach((c, i) => {
      expect(c.x - r).toBeGreaterThanOrEqual(area.minX);
      expect(c.x + r).toBeLessThanOrEqual(area.maxX);
      expect(c.z - r).toBeGreaterThanOrEqual(area.minZ);
      expect(distXZ(c, PIZZA_CENTER)).toBeGreaterThan(PIZZA_RADIUS + r);
      for (const other of centres.slice(i + 1)) expect(distXZ(c, other)).toBeGreaterThan(2 * r);
    });
  });
});

describe('viewport', () => {
  it('passes landscape coordinates straight through', () => {
    const v = landscapeViewport(1000, 500);
    expect(v.rotated).toBe(false);
    expect(clientToNdc(v, 0, 0)).toEqual({ x: -1, y: 1 });
    expect(clientToNdc(v, 1000, 500)).toEqual({ x: 1, y: -1 });
  });

  it('maps a portrait window onto the rotated landscape view', () => {
    const v = landscapeViewport(500, 1000);
    expect(v).toEqual({ width: 1000, height: 500, rotated: true });
    // Landscape top-left is the window's top-right after a clockwise quarter turn.
    expect(clientToNdc(v, 500, 0)).toEqual({ x: -1, y: 1 });
    expect(clientToNdc(v, 0, 1000)).toEqual({ x: 1, y: -1 });
  });
});
