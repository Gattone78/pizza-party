/**
 * Child-led pacing (P7): nothing happens while the child is busy. After
 * `firstDelay` seconds without activity a gentle hint fires, and again every
 * `repeatDelay` seconds for as long as the child stays idle.
 */
export class IdleTimer {
  private idleFor = 0;
  private nextAt: number;

  constructor(
    private readonly onIdle: () => void,
    private readonly firstDelay = 10,
    private readonly repeatDelay = 10,
  ) {
    this.nextAt = firstDelay;
  }

  /** The child did something, or the game is busy showing something. */
  poke(): void {
    this.idleFor = 0;
    this.nextAt = this.firstDelay;
  }

  update(dt: number): void {
    this.idleFor += dt;
    if (this.idleFor < this.nextAt) return;
    this.nextAt = this.idleFor + this.repeatDelay;
    this.onIdle();
  }
}
