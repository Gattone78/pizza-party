import { describe, expect, it } from 'vitest';
import { wireDragSounds } from '../src/audio/dragSounds';
import { SoundThrottle, type GameAudio, type SoundId } from '../src/audio/GameAudio';
import { IdleTimer } from '../src/core/IdleTimer';
import { vec3 } from '../src/core/vec';
import prompts from '../src/data/prompts.json';
import { DEFAULT_DRAG_CONFIG, DragController, type DragSource } from '../src/interact/DragController';
import type { DropZone } from '../src/interact/DropZone';
import { FakeInput, FakePiece } from './helpers';

class FakeAudio implements GameAudio {
  log: string[] = [];
  play(sound: SoundId) {
    this.log.push(sound);
  }
  say(promptId: string) {
    this.log.push(`say:${promptId}`);
  }
  buzz() {
    this.log.push('buzz');
  }
}

describe('IdleTimer (P7)', () => {
  const run = (timer: IdleTimer, seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) timer.update(0.1);
  };

  it('hints after 10 idle seconds, not before', () => {
    let hints = 0;
    const timer = new IdleTimer(() => hints++);
    run(timer, 9.5);
    expect(hints).toBe(0);
    run(timer, 1);
    expect(hints).toBe(1);
  });

  it('never hints while the child keeps playing', () => {
    let hints = 0;
    const timer = new IdleTimer(() => hints++);
    for (let i = 0; i < 10; i++) {
      run(timer, 8);
      timer.poke();
    }
    expect(hints).toBe(0);
  });

  it('repeats gently while still idle, and starts over after activity', () => {
    let hints = 0;
    const timer = new IdleTimer(() => hints++);
    run(timer, 31);
    expect(hints).toBe(3);
    timer.poke();
    run(timer, 9);
    expect(hints).toBe(3);
    run(timer, 2);
    expect(hints).toBe(4);
  });
});

describe('SoundThrottle', () => {
  it('limits sounds driven by drag movement but not one-off sounds', () => {
    const throttle = new SoundThrottle({ squirt: 0.1 });
    expect(throttle.allow('squirt', 0)).toBe(true);
    expect(throttle.allow('squirt', 0.05)).toBe(false);
    expect(throttle.allow('squirt', 0.11)).toBe(true);
    expect(throttle.allow('plop', 0)).toBe(true);
    expect(throttle.allow('plop', 0)).toBe(true);
  });
});

describe('drag sounds (P5, A6)', () => {
  const pizza: DropZone = { id: 'pizza', center: vec3(0, 0, 0), acceptRadius: 2, landRadius: 1, surfaceY: 0 };
  const onBowl = vec3(-3, 0, 0);
  const setup = () => {
    const input = new FakeInput();
    const audio = new FakeAudio();
    const source: DragSource = {
      draggable: { id: 'tomato', home: onBowl, validZones: ['pizza'] },
      pickRadius: 0.8,
      createPiece: () => new FakePiece(),
    };
    const controller = new DragController(input, [source], [pizza]);
    wireDragSounds(controller, audio);
    const settle = () => {
      for (let i = 0; i < 120; i++) controller.update(1 / 60);
    };
    return { input, audio, settle };
  };

  it('sounds and buzzes on the grab itself, with no delay', () => {
    const { input, audio } = setup();
    input.grab(onBowl);
    expect(audio.log).toEqual(['pop', 'buzz']);
  });

  it('plops when a piece lands on the pizza (G1.3)', () => {
    const { input, audio, settle } = setup();
    input.grab(onBowl);
    input.release(vec3(0, 0, -DEFAULT_DRAG_CONFIG.dropOffsetZ));
    settle();
    expect(audio.log).toEqual(['pop', 'buzz', 'plop', 'buzz']);
  });

  it('boings when a miss hops home (G1.4)', () => {
    const { input, audio, settle } = setup();
    input.grab(onBowl);
    input.release(vec3(4, 0, 2));
    settle();
    expect(audio.log).toEqual(['pop', 'buzz', 'boing']);
  });

  it('stops when unsubscribed', () => {
    const input = new FakeInput();
    const audio = new FakeAudio();
    const controller = new DragController(input, [], [pizza]);
    wireDragSounds(controller, audio)();
    input.grab(onBowl);
    expect(audio.log).toEqual([]);
  });
});

describe('prompts data (A5, X5)', () => {
  it('has a line for every moment the stages announce', () => {
    for (const id of ['sauce', 'cheese', 'toppings', 'bell', 'bake', 'baked', 'cut', 'plate', 'serve', 'celebrate']) {
      expect(prompts[id as keyof typeof prompts]).toBeTruthy();
    }
  });
});
