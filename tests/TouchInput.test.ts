import { beforeEach, describe, expect, it } from 'vitest';
import { vec3, type Vec3 } from '../src/core/vec';
import { TouchInput, type PointerLike, type PointerTarget } from '../src/input/TouchInput';

class FakeTarget implements PointerTarget {
  private listeners = new Map<string, Set<(e: PointerLike) => void>>();

  addEventListener(type: string, listener: (e: PointerLike) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (e: PointerLike) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string, e: PointerLike) {
    this.listeners.get(type)?.forEach((l) => l(e));
  }
}

const pointer = (pointerId: number, x: number, y: number, size = 20): PointerLike => ({
  pointerId,
  clientX: x,
  clientY: y,
  width: size,
  height: size,
});

let target: FakeTarget;
let input: TouchInput;
let log: string[];
let claim: boolean;

beforeEach(() => {
  target = new FakeTarget();
  // Client px map 1:1 onto counter x/z for the test.
  input = new TouchInput(target, (x, y): Vec3 => vec3(x, 0, y));
  log = [];
  claim = true;
  input.onGrab((e) => {
    log.push(`grab ${e.position.x},${e.position.z}`);
    return claim;
  });
  input.onMove((e) => log.push(`move ${e.position.x},${e.position.z}`));
  input.onRelease((e) => log.push(`release ${e.position.x},${e.position.z}`));
});

describe('TouchInput', () => {
  it('emits grab, move and release with world positions', () => {
    target.fire('pointerdown', pointer(1, 10, 20));
    target.fire('pointermove', pointer(1, 30, 40));
    target.fire('pointerup', pointer(1, 50, 60));
    expect(log).toEqual(['grab 10,20', 'move 30,40', 'release 50,60']);
  });

  it('ignores extra fingers while one is dragging', () => {
    target.fire('pointerdown', pointer(1, 10, 20));
    target.fire('pointerdown', pointer(2, 99, 99));
    target.fire('pointermove', pointer(2, 98, 98));
    target.fire('pointerup', pointer(2, 98, 98));
    target.fire('pointerup', pointer(1, 10, 20));
    expect(log).toEqual(['grab 10,20', 'release 10,20']);
  });

  it('ignores palm-sized contacts', () => {
    target.fire('pointerdown', pointer(1, 10, 20, 120));
    target.fire('pointerup', pointer(1, 10, 20, 120));
    expect(log).toEqual([]);
  });

  it('does not lock onto a pointer whose grab nothing claimed', () => {
    claim = false;
    target.fire('pointerdown', pointer(1, 10, 20));
    claim = true;
    target.fire('pointerdown', pointer(2, 30, 40));
    target.fire('pointermove', pointer(1, 11, 21));
    target.fire('pointerup', pointer(2, 30, 40));
    expect(log).toEqual(['grab 10,20', 'grab 30,40', 'release 30,40']);
  });

  it('treats pointercancel as a release so the piece still goes somewhere', () => {
    target.fire('pointerdown', pointer(1, 10, 20));
    target.fire('pointercancel', pointer(1, 15, 25));
    expect(log).toEqual(['grab 10,20', 'release 15,25']);
  });

  it('releases only once when several end events arrive', () => {
    target.fire('pointerdown', pointer(1, 10, 20));
    target.fire('pointerup', pointer(1, 10, 20));
    target.fire('lostpointercapture', pointer(1, 10, 20));
    expect(log.filter((l) => l.startsWith('release'))).toHaveLength(1);
  });

  it('cancel() releases at the last known position', () => {
    target.fire('pointerdown', pointer(1, 10, 20));
    target.fire('pointermove', pointer(1, 30, 40));
    input.cancel();
    expect(log.at(-1)).toBe('release 30,40');
  });
});
