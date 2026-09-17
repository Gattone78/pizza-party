/** Every sound effect in the game. Each action has its own (A6). */
export type SoundId =
  | 'grab'
  | 'pop'
  | 'plop'
  | 'boing'
  | 'squirt'
  | 'sprinkle'
  | 'swirl'
  | 'bell'
  | 'thunk'
  | 'door'
  | 'tick'
  | 'ding'
  | 'steam'
  | 'slice'
  | 'clink'
  | 'yum'
  | 'fanfare'
  | 'hint';

/**
 * What game code uses to make noise. Stages never touch Web Audio directly,
 * so the placeholder synth and speech can be swapped for real files later.
 */
export interface GameAudio {
  play(sound: SoundId): void;
  /** Speak the prompt with this id from prompts.json (A5). */
  say(promptId: string): void;
  /** Light haptic tick where the hardware supports it (A7). */
  buzz(): void;
}

/** Minimum gap between repeats of the same sound, for sounds driven by drag movement. */
export class SoundThrottle {
  private readonly lastPlayed = new Map<string, number>();

  constructor(private readonly minGapSeconds: Partial<Record<SoundId, number>>) {}

  /** True if `sound` may play at time `now` (seconds); records it if so. */
  allow(sound: SoundId, now: number): boolean {
    const gap = this.minGapSeconds[sound] ?? 0;
    const last = this.lastPlayed.get(sound);
    if (last !== undefined && now - last < gap) return false;
    this.lastPlayed.set(sound, now);
    return true;
  }
}
