/**
 * One step of the pizza loop (X1). A stage builds what it needs in `enter`,
 * removes all of it in `exit` (P4: one thing at a time), and is ticked only
 * while active. `Ctx` is whatever the app shares with stages.
 */
export interface Stage<Ctx> {
  readonly id: string;
  enter(ctx: Ctx): void;
  exit(): void;
  update(dt: number): void;
}
