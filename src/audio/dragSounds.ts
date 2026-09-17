import type { Unsubscribe } from '../core/events';
import type { DragController } from '../interact/DragController';
import type { GameAudio, SoundId } from './GameAudio';

export interface DragSoundMap {
  readonly grabbed?: SoundId;
  readonly placed?: SoundId;
  readonly returned?: SoundId;
}

export const DEFAULT_DRAG_SOUNDS: DragSoundMap = { grabbed: 'pop', placed: 'plop', returned: 'boing' };

/** Every grab, drop and miss gets a sound, and grabs and drops a haptic tick (P5, A6, A7). */
export function wireDragSounds(
  controller: DragController,
  audio: GameAudio,
  sounds: DragSoundMap = DEFAULT_DRAG_SOUNDS,
): Unsubscribe {
  const subscriptions = [
    controller.on('grabbed', () => {
      if (sounds.grabbed) audio.play(sounds.grabbed);
      audio.buzz();
    }),
    controller.on('placed', () => {
      if (sounds.placed) audio.play(sounds.placed);
      audio.buzz();
    }),
    controller.on('returned', () => {
      if (sounds.returned) audio.play(sounds.returned);
    }),
  ];
  return () => subscriptions.forEach((off) => off());
}
