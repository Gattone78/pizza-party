import { describe, expect, it } from 'vitest';
import {
  CutTracker,
  sliceCount,
  sliceIndexForPoint,
  sliceOffset,
  type Point2,
} from '../src/interact/CutTracker';

const R = 1.6;
const swipe = (tracker: CutTracker, from: Point2, to: Point2, steps = 20): number[] => {
  const done: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    done.push(...tracker.track({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }));
  }
  const snapped = tracker.endStroke();
  if (snapped !== null) done.push(snapped);
  return done;
};

describe('CutTracker', () => {
  it('cuts along a guide with a clean swipe', () => {
    const tracker = new CutTracker(2, R);
    expect(swipe(tracker, { x: -2, z: 0 }, { x: 2, z: 0 })).toEqual([0]);
    expect(tracker.done).toBe(false);
    expect(swipe(tracker, { x: 0, z: 2 }, { x: 0, z: -2 })).toEqual([1]);
    expect(tracker.done).toBe(true);
  });

  it('accepts a wobbly swipe roughly near the guide (G3.2)', () => {
    const tracker = new CutTracker(2, R);
    expect(swipe(tracker, { x: -1.8, z: 0.45 }, { x: 1.8, z: -0.4 })).toEqual([0]);
  });

  it('accumulates progress across short strokes', () => {
    const tracker = new CutTracker(2, R);
    expect(swipe(tracker, { x: -1.2, z: 0 }, { x: -0.3, z: 0 })).toEqual([]);
    expect(swipe(tracker, { x: -0.3, z: 0.1 }, { x: 0.9, z: 0.1 })).toEqual([0]);
  });

  it('a swipe along one guide does not also cut the crossing guide', () => {
    const tracker = new CutTracker(2, R);
    swipe(tracker, { x: -2, z: 0 }, { x: 2, z: 0 });
    expect(tracker.completed.has(1)).toBe(false);
  });

  it('snaps a diagonal swipe across the pizza to the best remaining guide, so every swipe cuts', () => {
    const tracker = new CutTracker(2, R);
    expect(swipe(tracker, { x: -1.2, z: -0.9 }, { x: 1.2, z: 0.9 })).toEqual([0]);
    expect(swipe(tracker, { x: -1.2, z: -0.9 }, { x: 1.2, z: 0.9 })).toEqual([1]);
    expect(tracker.done).toBe(true);
  });

  it('ignores taps and swipes that miss the pizza', () => {
    const tracker = new CutTracker(2, R);
    expect(swipe(tracker, { x: 0.2, z: 0.2 }, { x: 0.25, z: 0.2 })).toEqual([]);
    expect(swipe(tracker, { x: -3, z: 2.5 }, { x: 3, z: 2.5 })).toEqual([]);
    expect(tracker.completed.size).toBe(0);
  });

  it('supports three cuts for six slices (G3.3)', () => {
    const tracker = new CutTracker(3, R);
    for (let g = 0; g < 3; g++) {
      const a = (g * Math.PI) / 3;
      const d = { x: Math.cos(a) * 2, z: Math.sin(a) * 2 };
      expect(swipe(tracker, { x: -d.x, z: -d.z }, d)).toEqual([g]);
    }
    expect(tracker.done).toBe(true);
  });
});

describe('slices', () => {
  it('two cuts give four quadrant slices', () => {
    expect(sliceCount(2)).toBe(4);
    expect(sliceIndexForPoint({ x: 1, z: 1 }, 2)).toBe(0);
    expect(sliceIndexForPoint({ x: -1, z: 1 }, 2)).toBe(1);
    expect(sliceIndexForPoint({ x: -1, z: -1 }, 2)).toBe(2);
    expect(sliceIndexForPoint({ x: 1, z: -1 }, 2)).toBe(3);
  });

  it('slices part away from each completed cut only', () => {
    const none = sliceOffset(0, 2, new Set(), 0.1);
    expect(none.x).toBeCloseTo(0);
    expect(none.z).toBeCloseTo(0);
    // Guide 0 lies along x, so slices either side of it part in z.
    const first = sliceOffset(0, 2, new Set([0]), 0.1);
    expect(first.x).toBeCloseTo(0);
    expect(first.z).toBeCloseTo(0.1);
    expect(sliceOffset(3, 2, new Set([0]), 0.1).z).toBeCloseTo(-0.1);
    const both = sliceOffset(1, 2, new Set([0, 1]), 0.1);
    expect(both.x).toBeCloseTo(-0.1);
    expect(both.z).toBeCloseTo(0.1);
  });
});
