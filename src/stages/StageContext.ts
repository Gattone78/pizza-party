import type { Scene } from '@babylonjs/core/scene';
import type { CounterLayout } from '../core/counterLayout';
import type { Unsubscribe } from '../core/events';
import type { GrabInput } from '../input/GrabInput';
import type { DropZone } from '../interact/DropZone';

/** What the app shares with every stage. Input arrives only as a GrabInput (X2). */
export interface StageContext {
  readonly scene: Scene;
  readonly input: GrabInput;
  /** The pizza persists across stages; stages that drop things on it use this zone. */
  readonly pizzaZone: DropZone;
  layout(): CounterLayout;
  onLayoutChanged(handler: (layout: CounterLayout) => void): Unsubscribe;
  /** Advance to the next stage. */
  next(): void;
}
