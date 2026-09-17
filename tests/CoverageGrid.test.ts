import { describe, expect, it } from 'vitest';
import { CoverageGrid, strokePoints } from '../src/interact/CoverageGrid';

describe('CoverageGrid', () => {
  it('starts empty and fills as it is painted', () => {
    const grid = new CoverageGrid(1.35);
    expect(grid.coverage).toBe(0);
    grid.paint(0, 0, 0.4);
    const one = grid.coverage;
    expect(one).toBeGreaterThan(0.05);
    expect(one).toBeLessThan(0.15);
    grid.paint(0.6, 0, 0.4);
    expect(grid.coverage).toBeGreaterThan(one);
  });

  it('does not count the same spot twice', () => {
    const grid = new CoverageGrid(1.35);
    grid.paint(0.2, 0.2, 0.4);
    const once = grid.coverage;
    grid.paint(0.2, 0.2, 0.4);
    expect(grid.coverage).toBe(once);
  });

  it('ignores strokes off the pizza (G0.3)', () => {
    const grid = new CoverageGrid(1.35);
    expect(grid.paint(3, 3, 0.4)).toBe(false);
    expect(grid.coverage).toBe(0);
  });

  it('counts only the part of an edge dab that is on the pizza', () => {
    const grid = new CoverageGrid(1.35);
    expect(grid.paint(1.5, 0, 0.4)).toBe(true);
    expect(grid.coverage).toBeGreaterThan(0);
    expect(grid.coverage).toBeLessThan(0.05);
  });

  it('a toddler scribble reaches the 60% auto-fill threshold', () => {
    const grid = new CoverageGrid(1.35);
    for (let z = -1.2; z <= 1.2; z += 0.6) {
      for (const p of strokePoints({ x: -1.4, z }, { x: 1.4, z }, 0.2)) grid.paint(p.x, p.z, 0.4);
    }
    expect(grid.coverage).toBeGreaterThanOrEqual(0.6);
    expect(grid.coverage).toBeLessThanOrEqual(1);
  });

  it('resets', () => {
    const grid = new CoverageGrid(1.35);
    grid.paint(0, 0, 0.4);
    grid.reset();
    expect(grid.coverage).toBe(0);
  });
});

describe('strokePoints', () => {
  it('fills a fast swipe with points no further apart than the step, ending at the target', () => {
    const points = strokePoints({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.3);
    expect(points).toHaveLength(4);
    expect(points.at(-1)).toEqual({ x: 1, z: 0 });
    expect(points[0]!.x).toBeCloseTo(0.25);
  });

  it('returns the target for a tiny move', () => {
    expect(strokePoints({ x: 0, z: 0 }, { x: 0.01, z: 0 }, 0.3)).toEqual([{ x: 0.01, z: 0 }]);
  });
});
