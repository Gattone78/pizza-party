import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { CounterLayout } from '../core/counterLayout';
import type { Unsubscribe } from '../core/events';
import type { GrabInput } from '../input/GrabInput';
import type { NodeView } from './shared/greybox';
import type { Pizza } from './shared/Pizza';

export interface GameConfig {
  /** Straight cuts through the centre: 2 gives 4 slices, 3 gives 6 (G3.3). */
  readonly cuts: number;
  readonly bakeSeconds: number;
  readonly coverageToFill: number;
  readonly celebrateSeconds: number;
}

export interface PlateProp {
  readonly id: string;
  readonly node: TransformNode;
  readonly view: NodeView;
  /** The slice sitting on this plate, once plated. */
  slice: TransformNode | null;
}

export interface DinerProp {
  readonly id: string;
  readonly node: TransformNode;
}

/** Props made by one stage and used by later ones. Cleared when the round ends. */
export interface RoundProps {
  plates: PlateProp[];
  diners: DinerProp[];
}

/** What the app shares with every stage. Input arrives only as a GrabInput (X2). */
export interface StageContext {
  readonly scene: Scene;
  readonly input: GrabInput;
  readonly config: GameConfig;
  /** The pizza persists across stages. */
  readonly pizza: Pizza;
  readonly round: RoundProps;
  layout(): CounterLayout;
  onLayoutChanged(handler: (layout: CounterLayout) => void): Unsubscribe;
  /** Advance to the next stage. */
  next(): void;
}
