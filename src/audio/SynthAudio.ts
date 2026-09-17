import { SoundThrottle, type GameAudio, type SoundId } from './GameAudio';

/** One layer of a synthesised sound. */
interface Tone {
  readonly wave: OscillatorType | 'noise';
  /** Frequency in Hz, or the band-pass centre for noise. */
  readonly from: number;
  readonly to?: number;
  /** Start offset and length in seconds. */
  readonly at?: number;
  readonly dur: number;
  readonly gain?: number;
}

const note = (from: number, at: number, dur = 0.18, gain = 0.3): Tone => ({ wave: 'triangle', from, at, dur, gain });

/**
 * Placeholder sounds, synthesised so the game needs no audio files yet.
 * All are short, soft and rounded; nothing harsh or startling.
 */
const SOUNDS: Record<SoundId, readonly Tone[]> = {
  grab: [{ wave: 'sine', from: 320, to: 520, dur: 0.09 }],
  pop: [{ wave: 'sine', from: 380, to: 760, dur: 0.08, gain: 0.35 }],
  plop: [{ wave: 'sine', from: 520, to: 140, dur: 0.16, gain: 0.4 }],
  boing: [
    { wave: 'triangle', from: 220, to: 440, dur: 0.12 },
    { wave: 'triangle', from: 440, to: 300, at: 0.12, dur: 0.16, gain: 0.2 },
  ],
  squirt: [{ wave: 'noise', from: 900, to: 500, dur: 0.14, gain: 0.22 }],
  sprinkle: [{ wave: 'noise', from: 5000, to: 6500, dur: 0.07, gain: 0.12 }],
  swirl: [
    { wave: 'sine', from: 300, to: 900, dur: 0.6, gain: 0.2 },
    { wave: 'noise', from: 800, to: 2400, dur: 0.6, gain: 0.08 },
  ],
  bell: [
    { wave: 'sine', from: 1320, dur: 0.7, gain: 0.3 },
    { wave: 'sine', from: 1980, dur: 0.5, gain: 0.12 },
  ],
  thunk: [{ wave: 'sine', from: 160, to: 70, dur: 0.18, gain: 0.5 }],
  door: [
    { wave: 'noise', from: 300, dur: 0.12, gain: 0.25 },
    { wave: 'sine', from: 110, to: 80, dur: 0.15, gain: 0.35 },
  ],
  tick: [{ wave: 'square', from: 1100, dur: 0.025, gain: 0.08 }],
  ding: [
    { wave: 'sine', from: 1568, dur: 1.1, gain: 0.35 },
    { wave: 'sine', from: 3136, dur: 0.6, gain: 0.08 },
  ],
  steam: [{ wave: 'noise', from: 3000, to: 1500, dur: 0.7, gain: 0.1 }],
  slice: [
    { wave: 'noise', from: 2500, to: 1200, dur: 0.16, gain: 0.2 },
    { wave: 'sine', from: 700, to: 350, dur: 0.12, gain: 0.15 },
  ],
  clink: [
    { wave: 'sine', from: 2100, dur: 0.18, gain: 0.2 },
    { wave: 'sine', from: 2800, dur: 0.12, gain: 0.1 },
  ],
  yum: [
    { wave: 'triangle', from: 330, to: 440, dur: 0.16 },
    { wave: 'triangle', from: 440, to: 590, at: 0.16, dur: 0.22 },
  ],
  fanfare: [note(523, 0), note(659, 0.15), note(784, 0.3), note(1047, 0.45, 0.5, 0.35)],
  hint: [
    { wave: 'sine', from: 880, dur: 0.25, gain: 0.12 },
    { wave: 'sine', from: 1175, at: 0.18, dur: 0.35, gain: 0.12 },
  ],
};

/** Sounds fired from drag movement would otherwise machine-gun. */
const MIN_GAPS: Partial<Record<SoundId, number>> = { squirt: 0.11, sprinkle: 0.06, tick: 0.2 };

export interface AudioSettings {
  sounds: boolean;
  voice: boolean;
}

/**
 * Web Audio synth for sound effects and the browser's built-in speech for
 * voice prompts. Both are placeholders for the shipped audio files of the art
 * and audio phase, and both work offline (N1).
 */
export class SynthAudio implements GameAudio {
  readonly settings: AudioSettings = { sounds: true, voice: true };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly throttle = new SoundThrottle(MIN_GAPS);
  private unlocked = false;
  private pendingPrompt: string | null = null;

  constructor(private readonly prompts: Readonly<Record<string, string>>) {}

  /**
   * Browsers only allow audio after a user gesture. Call this from one; it is
   * cheap to call on every gesture.
   */
  unlock(): void {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.context.destination);
      }
    }
    if (this.context?.state === 'suspended') void this.context.resume();
    if (!this.unlocked) {
      this.unlocked = true;
      // The prompt for the opening stage was asked for before any gesture.
      if (this.pendingPrompt) this.say(this.pendingPrompt);
    }
  }

  play(sound: SoundId): void {
    const context = this.context;
    if (!this.settings.sounds || !context || !this.master || context.state !== 'running') return;
    if (!this.throttle.allow(sound, context.currentTime)) return;
    for (const tone of SOUNDS[sound]) this.playTone(context, this.master, tone);
  }

  say(promptId: string): void {
    const text = this.prompts[promptId];
    if (!text || !this.settings.voice || !('speechSynthesis' in window)) return;
    if (!this.unlocked) {
      this.pendingPrompt = promptId;
      return;
    }
    this.pendingPrompt = null;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en';
      utterance.rate = 0.9;
      utterance.pitch = 1.15;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech is a nicety; never let it interrupt play (N6).
    }
  }

  buzz(): void {
    try {
      navigator.vibrate?.(8);
    } catch {
      // Not supported; fine.
    }
  }

  private playTone(context: AudioContext, out: AudioNode, tone: Tone): void {
    const start = context.currentTime + (tone.at ?? 0);
    const end = start + tone.dur;
    const gain = context.createGain();
    const peak = tone.gain ?? 0.3;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(out);

    if (tone.wave === 'noise') {
      const source = context.createBufferSource();
      source.buffer = this.noiseBuffer(context);
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(tone.from, start);
      if (tone.to) filter.frequency.exponentialRampToValueAtTime(tone.to, end);
      source.connect(filter).connect(gain);
      source.start(start);
      source.stop(end + 0.02);
    } else {
      const osc = context.createOscillator();
      osc.type = tone.wave;
      osc.frequency.setValueAtTime(tone.from, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
      osc.connect(gain);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (!this.noise) {
      this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}
