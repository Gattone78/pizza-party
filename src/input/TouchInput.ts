import type { Unsubscribe } from '../core/events';
import type { Vec3 } from '../core/vec';
import type { GrabEventHandler, GrabHandler, GrabInput } from './GrabInput';

/** The slice of PointerEvent this class reads; keeps it testable without a DOM. */
export interface PointerLike {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly width?: number;
  readonly height?: number;
  preventDefault?(): void;
}

export interface PointerTarget {
  // `any` so both a real canvas and a test fake satisfy this.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, listener: (e: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: string, listener: (e: any) => void): void;
  setPointerCapture?(pointerId: number): void;
}

/** Contacts wider than this (CSS px) are treated as a resting palm and ignored. */
const PALM_SIZE_PX = 70;

/**
 * GrabInput for touch, mouse and pen via pointer events. The first pointer
 * whose grab is claimed owns the drag; every other pointer is ignored until
 * it lifts (T4). `toWorld` maps client coordinates onto the counter plane.
 */
export class TouchInput implements GrabInput {
  private readonly grabHandlers = new Set<GrabHandler>();
  private readonly moveHandlers = new Set<GrabEventHandler>();
  private readonly releaseHandlers = new Set<GrabEventHandler>();
  private activeId: number | null = null;
  private lastPosition: Vec3 | null = null;

  constructor(
    private readonly target: PointerTarget,
    private readonly toWorld: (clientX: number, clientY: number) => Vec3 | null,
    /**
     * Called on every finger down and up, claimed or not. Browsers only unlock
     * audio inside a real gesture handler, and this is the only place that sees one.
     */
    private readonly onUserGesture?: () => void,
  ) {
    target.addEventListener('pointerdown', this.handleDown);
    target.addEventListener('pointermove', this.handleMove);
    target.addEventListener('pointerup', this.handleEnd);
    target.addEventListener('pointercancel', this.handleEnd);
    target.addEventListener('lostpointercapture', this.handleEnd);
  }

  onGrab(handler: GrabHandler): Unsubscribe {
    this.grabHandlers.add(handler);
    return () => this.grabHandlers.delete(handler);
  }

  onMove(handler: GrabEventHandler): Unsubscribe {
    this.moveHandlers.add(handler);
    return () => this.moveHandlers.delete(handler);
  }

  onRelease(handler: GrabEventHandler): Unsubscribe {
    this.releaseHandlers.add(handler);
    return () => this.releaseHandlers.delete(handler);
  }

  /** End any drag in progress, e.g. when the app loses focus. */
  cancel(): void {
    if (this.activeId === null) return;
    this.activeId = null;
    const position = this.lastPosition;
    if (position) this.releaseHandlers.forEach((h) => h({ position }));
  }

  dispose(): void {
    this.cancel();
    this.target.removeEventListener('pointerdown', this.handleDown);
    this.target.removeEventListener('pointermove', this.handleMove);
    this.target.removeEventListener('pointerup', this.handleEnd);
    this.target.removeEventListener('pointercancel', this.handleEnd);
    this.target.removeEventListener('lostpointercapture', this.handleEnd);
    this.grabHandlers.clear();
    this.moveHandlers.clear();
    this.releaseHandlers.clear();
  }

  private readonly handleDown = (e: PointerLike): void => {
    e.preventDefault?.();
    this.onUserGesture?.();
    if (this.activeId !== null) return;
    if ((e.width ?? 0) > PALM_SIZE_PX || (e.height ?? 0) > PALM_SIZE_PX) return;
    const position = this.toWorld(e.clientX, e.clientY);
    if (!position) return;

    let claimed = false;
    this.grabHandlers.forEach((h) => {
      if (h({ position })) claimed = true;
    });
    if (!claimed) return;

    this.activeId = e.pointerId;
    this.lastPosition = position;
    try {
      this.target.setPointerCapture?.(e.pointerId);
    } catch {
      // Capture is a nicety; the drag works without it.
    }
  };

  private readonly handleMove = (e: PointerLike): void => {
    if (e.pointerId !== this.activeId) return;
    const position = this.toWorld(e.clientX, e.clientY);
    if (!position) return;
    this.lastPosition = position;
    this.moveHandlers.forEach((h) => h({ position }));
  };

  private readonly handleEnd = (e: PointerLike): void => {
    this.onUserGesture?.();
    if (e.pointerId !== this.activeId) return;
    const position = this.toWorld(e.clientX, e.clientY);
    if (position) this.lastPosition = position;
    this.cancel();
  };
}
