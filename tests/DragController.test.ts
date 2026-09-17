import { beforeEach, describe, expect, it } from 'vitest';
import { distXZ, vec3 } from '../src/core/vec';
import {
  DEFAULT_DRAG_CONFIG,
  DragController,
  type DragSource,
} from '../src/interact/DragController';
import type { DropZone } from '../src/interact/DropZone';
import { FakeInput, FakePiece } from './helpers';

const pizza: DropZone = {
  id: 'pizza',
  center: vec3(0, 0, 0.5),
  acceptRadius: 2,
  landRadius: 1.2,
  surfaceY: 0.14,
};
const bowlHome = vec3(-2, 0.35, -2);
const onBowl = vec3(-2, 0, -2);
const cfg = DEFAULT_DRAG_CONFIG;
/** Finger position that puts the drop point exactly on `target`. */
const fingerFor = (x: number, z: number) => vec3(x, 0, z - cfg.dropOffsetZ);

let input: FakeInput;
let pieces: FakePiece[];
let controller: DragController;

const settle = () => {
  for (let i = 0; i < 120; i++) controller.update(1 / 60);
};

beforeEach(() => {
  input = new FakeInput();
  pieces = [];
  const source: DragSource = {
    draggable: { id: 'pepperoni', home: bowlHome, validZones: ['pizza'] },
    pickRadius: 0.8,
    createPiece: () => {
      const piece = new FakePiece();
      pieces.push(piece);
      return piece;
    },
  };
  controller = new DragController(input, [source], [pizza]);
});

describe('DragController', () => {
  it('spawns a piece at the finger on grab, immediately and lifted', () => {
    expect(input.grab(onBowl)).toBe(true);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.position).toEqual(vec3(-2, cfg.lift, -2 + cfg.carryOffsetZ));
    expect(controller.isDragging).toBe(true);
  });

  it('grabs on a near miss within the pick radius', () => {
    expect(input.grab(vec3(-2.7, 0, -2))).toBe(true);
  });

  it('does nothing, and does not claim, when grabbing away from any bowl', () => {
    expect(input.grab(vec3(3, 0, 2))).toBe(false);
    input.move(vec3(1, 0, 1));
    input.release(vec3(1, 0, 1));
    settle();
    expect(pieces).toHaveLength(0);
  });

  it('follows moves kinematically', () => {
    input.grab(onBowl);
    input.move(vec3(1, 0, 0));
    expect(pieces[0]!.position).toEqual(vec3(1, cfg.lift, cfg.carryOffsetZ));
  });

  it('lands on the pizza surface and stays when released over it', () => {
    const placed: string[] = [];
    controller.on('placed', (e) => placed.push(e.zoneId));
    input.grab(onBowl);
    input.release(fingerFor(0.4, 0.8));
    settle();
    const piece = pieces[0]!;
    expect(piece.disposed).toBe(false);
    expect(piece.position!.x).toBeCloseTo(0.4);
    expect(piece.position!.y).toBeCloseTo(pizza.surfaceY);
    expect(piece.position!.z).toBeCloseTo(0.8);
    expect(placed).toEqual(['pizza']);
  });

  it('bounces on landing: dips to the surface then rises before settling', () => {
    input.grab(onBowl);
    input.release(fingerFor(0, 0.5));
    const heights: number[] = [];
    for (let i = 0; i < 60; i++) {
      controller.update(1 / 120);
      heights.push(pieces[0]!.position!.y);
    }
    const firstTouch = heights.findIndex((y) => y - pizza.surfaceY < 0.01);
    expect(firstTouch).toBeGreaterThan(0);
    expect(Math.max(...heights.slice(firstTouch))).toBeGreaterThan(pizza.surfaceY + 0.03);
    expect(heights.at(-1)).toBeCloseTo(pizza.surfaceY);
  });

  it('pulls a release just outside the crust onto the pizza', () => {
    input.grab(onBowl);
    input.release(fingerFor(1.9, 0.5));
    settle();
    expect(pieces[0]!.disposed).toBe(false);
    expect(distXZ(pieces[0]!.position!, pizza.center)).toBeCloseTo(pizza.landRadius);
  });

  it('hops home and is removed when released off the pizza', () => {
    const returned: string[] = [];
    controller.on('returned', (e) => returned.push(e.sourceId));
    input.grab(onBowl);
    input.move(vec3(3, 0, 1));
    input.release(vec3(3, 0, 1));

    controller.update(cfg.returnDuration / 2);
    const piece = pieces[0]!;
    expect(piece.disposed).toBe(false);
    expect(piece.maxY).toBeGreaterThan(cfg.lift);

    settle();
    expect(piece.position!.x).toBeCloseTo(bowlHome.x);
    expect(piece.position!.y).toBeCloseTo(bowlHome.y);
    expect(piece.position!.z).toBeCloseTo(bowlHome.z);
    expect(piece.disposed).toBe(true);
    expect(returned).toEqual(['pepperoni']);
  });

  it('ignores a second grab while dragging', () => {
    input.grab(onBowl);
    expect(input.grab(onBowl)).toBe(false);
    expect(pieces).toHaveLength(1);
  });

  it('never runs out: every grab after a release spawns a new piece', () => {
    for (let i = 0; i < 5; i++) {
      input.grab(onBowl);
      input.release(fingerFor(0, 0.5));
    }
    settle();
    expect(pieces).toHaveLength(5);
    expect(pieces.every((p) => !p.disposed)).toBe(true);
  });

  it('stacks landed pieces slightly higher each time to avoid z-fighting', () => {
    input.grab(onBowl);
    input.release(fingerFor(0, 0.5));
    input.grab(onBowl);
    input.release(fingerFor(0, 0.5));
    settle();
    expect(pieces[1]!.position!.y).toBeGreaterThan(pieces[0]!.position!.y);
  });

  it('can start a new drag while the last piece is still returning', () => {
    input.grab(onBowl);
    input.release(vec3(3, 0, 1));
    expect(input.grab(onBowl)).toBe(true);
    settle();
    expect(pieces[0]!.disposed).toBe(true);
    expect(pieces[1]!.disposed).toBe(false);
  });

  it('tolerates move and release with no active drag', () => {
    expect(() => {
      input.move(vec3(0, 0, 0));
      input.release(vec3(0, 0, 0));
      settle();
    }).not.toThrow();
  });

  it('removes a carried piece and stops listening on dispose', () => {
    input.grab(onBowl);
    controller.dispose();
    expect(pieces[0]!.disposed).toBe(true);
    expect(input.grab(onBowl)).toBe(false);
  });
});
