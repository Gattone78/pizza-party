import { describe, expect, it } from 'vitest';
import type { Stage } from '../src/core/Stage';
import { StageMachine } from '../src/core/StageMachine';

interface Ctx {
  readonly log: string[];
}

const makeStage = (id: string): Stage<Ctx> & { ticks: number } => {
  let log: string[] = [];
  return {
    id,
    ticks: 0,
    enter(ctx) {
      log = ctx.log;
      log.push(`enter ${id}`);
    },
    exit() {
      log.push(`exit ${id}`);
    },
    update() {
      this.ticks++;
    },
  };
};

describe('StageMachine', () => {
  it('starts in the first registered stage', () => {
    const ctx: Ctx = { log: [] };
    const machine = new StageMachine(ctx).register(makeStage('toppings'));
    expect(machine.current).toBeNull();
    machine.start();
    expect(machine.current?.id).toBe('toppings');
    expect(ctx.log).toEqual(['enter toppings']);
  });

  it('exits the old stage before entering the next', () => {
    const ctx: Ctx = { log: [] };
    const machine = new StageMachine(ctx)
      .register(makeStage('toppings'))
      .register(makeStage('bake'));
    machine.start();
    machine.advance();
    expect(ctx.log).toEqual(['enter toppings', 'exit toppings', 'enter bake']);
  });

  it('wraps from the last stage to the first for a fresh pizza', () => {
    const ctx: Ctx = { log: [] };
    const machine = new StageMachine(ctx)
      .register(makeStage('toppings'))
      .register(makeStage('bake'));
    machine.start();
    machine.advance();
    machine.advance();
    expect(machine.current?.id).toBe('toppings');
  });

  it('with a single stage, advance re-enters it', () => {
    const ctx: Ctx = { log: [] };
    const machine = new StageMachine(ctx).register(makeStage('toppings'));
    machine.start();
    machine.advance();
    expect(ctx.log).toEqual(['enter toppings', 'exit toppings', 'enter toppings']);
  });

  it('updates only the active stage', () => {
    const toppings = makeStage('toppings');
    const bake = makeStage('bake');
    const machine = new StageMachine<Ctx>({ log: [] }).register(toppings).register(bake);
    machine.update(0.016);
    machine.start();
    machine.update(0.016);
    machine.update(0.016);
    expect(toppings.ticks).toBe(2);
    expect(bake.ticks).toBe(0);
  });

  it('can jump to a stage by id and reports changes', () => {
    const changes: Array<[string | null, string]> = [];
    const machine = new StageMachine<Ctx>({ log: [] })
      .register(makeStage('toppings'))
      .register(makeStage('bake'))
      .register(makeStage('cut'));
    machine.onChanged((e) => changes.push([e.from, e.to]));
    machine.start();
    machine.goTo('cut');
    expect(changes).toEqual([
      [null, 'toppings'],
      ['toppings', 'cut'],
    ]);
  });

  it('rejects duplicate and unknown stage ids', () => {
    const machine = new StageMachine<Ctx>({ log: [] }).register(makeStage('toppings'));
    expect(() => machine.register(makeStage('toppings'))).toThrow();
    expect(() => machine.goTo('nope')).toThrow();
    expect(() => new StageMachine<Ctx>({ log: [] }).start()).toThrow();
  });
});
