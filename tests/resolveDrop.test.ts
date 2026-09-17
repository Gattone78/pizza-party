import { describe, expect, it } from 'vitest';
import { distXZ, vec3 } from '../src/core/vec';
import type { DropZone } from '../src/interact/DropZone';
import { pickNearest } from '../src/interact/pickNearest';
import { resolveDrop } from '../src/interact/resolveDrop';

const pizza: DropZone = {
  id: 'pizza',
  center: vec3(0, 0, 0.5),
  acceptRadius: 2,
  landRadius: 1.2,
  surfaceY: 0.14,
};
const topping = { validZones: ['pizza'] };

describe('resolveDrop', () => {
  it('lands where released when inside the land radius, at the surface height', () => {
    const result = resolveDrop(vec3(0.5, 0, 1), topping, [pizza]);
    expect(result).toEqual({ kind: 'zone', zone: pizza, landAt: vec3(0.5, 0.14, 1) });
  });

  it('pulls a near miss in to the land radius along the line to the centre', () => {
    const result = resolveDrop(vec3(1.9, 0.5, 0.5), topping, [pizza]);
    if (result.kind !== 'zone') throw new Error('expected a zone');
    expect(result.landAt.x).toBeCloseTo(1.2);
    expect(result.landAt.z).toBeCloseTo(0.5);
    expect(distXZ(result.landAt, pizza.center)).toBeCloseTo(pizza.landRadius);
  });

  it('goes home when released outside the accept radius', () => {
    expect(resolveDrop(vec3(2.5, 0, 0.5), topping, [pizza])).toEqual({ kind: 'home' });
  });

  it('goes home when the zone is not valid for the draggable', () => {
    expect(resolveDrop(vec3(0, 0, 0.5), { validZones: ['plate'] }, [pizza])).toEqual({
      kind: 'home',
    });
  });

  it('goes home when there are no zones', () => {
    expect(resolveDrop(vec3(0, 0, 0), topping, [])).toEqual({ kind: 'home' });
  });

  it('picks the nearest of overlapping valid zones', () => {
    const plateA: DropZone = { ...pizza, id: 'a', center: vec3(-1, 0, 0) };
    const plateB: DropZone = { ...pizza, id: 'b', center: vec3(1, 0, 0) };
    const result = resolveDrop(vec3(0.3, 0, 0), { validZones: ['a', 'b'] }, [plateA, plateB]);
    expect(result.kind === 'zone' && result.zone.id).toBe('b');
  });
});

describe('resolveDrop with capacity', () => {
  const plate = (id: string, x: number): DropZone => ({
    id,
    center: vec3(x, 0, 0),
    acceptRadius: 1,
    landRadius: 0,
    surfaceY: 0.08,
    capacity: 1,
  });
  const plates = [plate('a', -3), plate('b', 3)];
  const slice = { validZones: ['a', 'b'] };

  it('snaps to the centre of a free plate', () => {
    const result = resolveDrop(vec3(-2.6, 0, 0.3), slice, plates, new Map());
    expect(result).toEqual({ kind: 'zone', zone: plates[0], landAt: vec3(-3, 0.08, 0) });
  });

  it('sends a drop on a full plate to the nearest free plate, however far', () => {
    const result = resolveDrop(vec3(-3, 0, 0), slice, plates, new Map([['a', 1]]));
    expect(result.kind === 'zone' && result.zone.id).toBe('b');
  });

  it('still goes home when dropped on nothing', () => {
    expect(resolveDrop(vec3(0, 0, 0), slice, plates, new Map([['a', 1]]))).toEqual({ kind: 'home' });
  });

  it('goes home when every plate is full', () => {
    const full = new Map([['a', 1], ['b', 1]]);
    expect(resolveDrop(vec3(-3, 0, 0), slice, plates, full)).toEqual({ kind: 'home' });
  });
});

describe('pickNearest', () => {
  const bowls = [
    { item: 'left', center: vec3(-2, 0.35, -2), pickRadius: 1.5 },
    { item: 'right', center: vec3(0, 0.35, -2), pickRadius: 1.5 },
  ];

  it('grabs on a near miss inside the pick radius', () => {
    expect(pickNearest(bowls, vec3(1.2, 0, -2))).toBe('right');
  });

  it('prefers the nearest when pick radii overlap', () => {
    expect(pickNearest(bowls, vec3(-1.1, 0, -2))).toBe('left');
    expect(pickNearest(bowls, vec3(-0.9, 0, -2))).toBe('right');
  });

  it('returns null out of reach', () => {
    expect(pickNearest(bowls, vec3(3, 0, 2))).toBeNull();
  });
});
