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
  music: boolean;
}

/** A gentle music-box loop on a pentatonic scale, so no two notes ever clash. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const BEAT = 60 / 84 / 2;
/** Scale steps per eighth note; -1 is a rest. Eight bars, then it loops (A6). */
const MELODY = [
  0, -1, 2, 3, 4, -1, 3, -1, 2, -1, 3, 2, 0, -1, -1, -1,
  1, -1, 3, 4, 5, -1, 4, -1, 3, -1, 4, 3, 1, -1, -1, -1,
  2, -1, 4, 5, 6, -1, 5, -1, 4, -1, 5, 4, 2, -1, 3, -1,
  4, -1, 3, 2, 3, -1, 1, -1, 0, -1, -1, -1, 0, -1, -1, -1,
];
const BASS = [0, 3, 4, 0];

/**
 * All game audio through one Web Audio context: synthesised sound effects,
 * a procedural music loop, and the spoken prompts shipped as
 * public/assets/voice/<promptId>.mp3. Nothing is fetched from outside the
 * app, so it all works offline (N1). If a voice file is missing, the
 * browser's built-in speech stands in.
 */
export class SynthAudio implements GameAudio {
  readonly settings: AudioSettings = { sounds: true, voice: true, music: true };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private readonly voices = new Map<string, AudioBuffer>();
  private speaking: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private nextBeatAt = 0;
  private beat = 0;
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
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = 1;
        this.musicGain.connect(this.master);
        this.loading = this.loadVoices(this.context).then(() => {
          this.loading = null;
        });
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

  /** Call every frame: keeps the music scheduled a little ahead of the clock. */
  update(): void {
    const context = this.context;
    if (!context || !this.musicGain || context.state !== 'running') return;
    if (!this.settings.music) {
      this.nextBeatAt = 0;
      return;
    }
    if (this.nextBeatAt < context.currentTime) this.nextBeatAt = context.currentTime + 0.1;
    while (this.nextBeatAt < context.currentTime + 0.4) {
      const step = MELODY[this.beat % MELODY.length] ?? -1;
      const note = SCALE[step];
      if (note) this.playTone(context, this.musicGain, { wave: 'sine', from: note * 2, dur: 0.9, gain: 0.05 }, this.nextBeatAt);
      if (this.beat % 8 === 0) {
        const bass = SCALE[BASS[(this.beat / 16) % BASS.length | 0] ?? 0];
        if (bass) this.playTone(context, this.musicGain, { wave: 'triangle', from: bass / 2, dur: 2.2, gain: 0.06 }, this.nextBeatAt);
      }
      this.beat++;
      this.nextBeatAt += BEAT;
    }
  }

  say(promptId: string): void {
    const text = this.prompts[promptId];
    if (!text || !this.settings.voice) return;
    if (!this.unlocked) {
      this.pendingPrompt = promptId;
      return;
    }
    this.pendingPrompt = null;
    if (this.loading) {
      // The files are tiny and local; wait for them rather than speak in a different voice.
      void this.loading.then(() => this.say(promptId));
      return;
    }

    const buffer = this.voices.get(promptId);
    const context = this.context;
    if (buffer && context && this.master) {
      try {
        this.speaking?.stop();
      } catch {
        // Already finished.
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.master);
      source.start();
      this.speaking = source;
      // Duck the music under the voice so the words are easy to hear.
      const music = this.musicGain?.gain;
      if (music) {
        const now = context.currentTime;
        music.cancelScheduledValues(now);
        music.setTargetAtTime(0.3, now, 0.05);
        music.setTargetAtTime(1, now + buffer.duration, 0.3);
      }
      return;
    }

    if (!('speechSynthesis' in window)) return;
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

  private async loadVoices(context: AudioContext): Promise<void> {
    await Promise.all(
      Object.keys(this.prompts).map(async (id) => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}assets/voice/${id}.mp3`);
          if (!response.ok) return;
          this.voices.set(id, await context.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // A missing or undecodable file falls back to built-in speech.
        }
      }),
    );
  }

  private playTone(context: AudioContext, out: AudioNode, tone: Tone, at = context.currentTime): void {
    const start = at + (tone.at ?? 0);
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
