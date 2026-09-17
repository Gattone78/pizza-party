import type { Unsubscribe } from '../core/events';
import type { Vec3 } from '../core/vec';

export interface GrabEvent {
  /** World-space position. For touch this lies on the counter plane. */
  readonly position: Vec3;
}

/**
 * Return true to claim the grab. An unclaimed grab (nothing was in reach)
 * produces no move or release events, and leaves the input free so a stray
 * finger or resting palm never blocks the hand that is actually playing (T4).
 */
export type GrabHandler = (e: GrabEvent) => boolean;
export type GrabEventHandler = (e: GrabEvent) => void;

/**
 * The only input surface game code may use (X2). Touch and XR are
 * implementations behind it; one grab is active at a time.
 */
export interface GrabInput {
  onGrab(handler: GrabHandler): Unsubscribe;
  onMove(handler: GrabEventHandler): Unsubscribe;
  onRelease(handler: GrabEventHandler): Unsubscribe;
  dispose(): void;
}
