export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/** 0 at both ends, 1 in the middle: the height of a hop. */
export const hopArc = (t: number): number => Math.sin(Math.PI * t);

/** Overshoots 1 slightly before settling: for popping something into view. */
export const easeOutBack = (t: number): number => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/**
 * Height of a dropped object as a fraction of its start height: falls to 0 at
 * `t = 0.55`, then one small bounce that settles at 0.
 */
export function dropBounce(t: number): number {
  const fall = 0.55;
  if (t < fall) return 1 - (t / fall) ** 2;
  const q = (t - fall) / (1 - fall);
  return 0.22 * 4 * q * (1 - q);
}

interface Tween {
  elapsed: number;
  readonly duration: number;
  readonly onUpdate: (t: number) => void;
  readonly onComplete?: () => void;
}

/** Steps time-based tweens from the game loop. No timers, so tests are deterministic. */
export class TweenRunner {
  private tweens: Tween[] = [];

  get activeCount(): number {
    return this.tweens.length;
  }

  /** `onUpdate` receives linear progress 0..1 and is always called with exactly 1 at the end. */
  add(duration: number, onUpdate: (t: number) => void, onComplete?: () => void): void {
    this.tweens.push({ elapsed: 0, duration, onUpdate, onComplete });
  }

  update(dt: number): void {
    if (this.tweens.length === 0) return;
    const running = this.tweens;
    this.tweens = [];
    const finished: Tween[] = [];
    for (const tween of running) {
      tween.elapsed += dt;
      if (tween.elapsed >= tween.duration) {
        tween.onUpdate(1);
        finished.push(tween);
      } else {
        tween.onUpdate(tween.elapsed / tween.duration);
        this.tweens.push(tween);
      }
    }
    // Completion callbacks may add new tweens, which land in this.tweens.
    for (const tween of finished) tween.onComplete?.();
  }

  clear(): void {
    this.tweens = [];
  }
}
