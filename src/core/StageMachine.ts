import { Emitter, type Unsubscribe } from './events';
import type { Stage } from './Stage';

interface StageMachineEvents {
  changed: { from: string | null; to: string };
}

/**
 * Owns game flow (X1). Stages run in registration order and the loop wraps,
 * so the last stage advances back to the first for a fresh pizza.
 */
export class StageMachine<Ctx> {
  private readonly stages: Stage<Ctx>[] = [];
  private readonly events = new Emitter<StageMachineEvents>();
  private active: Stage<Ctx> | null = null;

  constructor(private readonly ctx: Ctx) {}

  get current(): Stage<Ctx> | null {
    return this.active;
  }

  register(stage: Stage<Ctx>): this {
    if (this.stages.some((s) => s.id === stage.id)) {
      throw new Error(`Stage "${stage.id}" is already registered`);
    }
    this.stages.push(stage);
    return this;
  }

  /** Enter the first registered stage, or `id` if given. */
  start(id?: string): void {
    const first = id ?? this.stages[0]?.id;
    if (first === undefined) throw new Error('No stages registered');
    this.goTo(first);
  }

  goTo(id: string): void {
    const next = this.stages.find((s) => s.id === id);
    if (!next) throw new Error(`Unknown stage "${id}"`);
    const from = this.active?.id ?? null;
    this.active?.exit();
    this.active = next;
    next.enter(this.ctx);
    this.events.emit('changed', { from, to: id });
  }

  /** Move to the next stage, wrapping to the first after the last. */
  advance(): void {
    if (!this.active) return this.start();
    const index = this.stages.indexOf(this.active);
    const next = this.stages[(index + 1) % this.stages.length];
    if (next) this.goTo(next.id);
  }

  update(dt: number): void {
    this.active?.update(dt);
  }

  onChanged(handler: (e: StageMachineEvents['changed']) => void): Unsubscribe {
    return this.events.on('changed', handler);
  }
}
