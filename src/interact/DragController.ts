import { Emitter, type Unsubscribe } from '../core/events';
import { lerp, lerpVec, vec3, type Vec3 } from '../core/vec';
import type { GrabInput } from '../input/GrabInput';
import type { Draggable } from './Draggable';
import type { DropZone } from './DropZone';
import { pickNearest } from './pickNearest';
import { resolveDrop } from './resolveDrop';
import { TweenRunner, dropBounce, easeInOutQuad, easeOutBack, easeOutCubic, hopArc } from './tween';

/** What the controller needs from a rendered piece. The Babylon side implements this. */
export interface PieceView {
  setPosition(p: Vec3): void;
  setScale(s: number): void;
  dispose(): void;
}

/** Something pieces are dragged out of, e.g. a topping bowl. It never runs out (G1.2). */
export interface DragSource {
  readonly draggable: Draggable;
  readonly pickRadius: number;
  createPiece(): PieceView;
}

export interface DragConfig {
  /** Height a carried piece rides above the counter. */
  readonly lift: number;
  /** Carried pieces sit this far up-screen (+z) of the finger so it does not hide them. */
  readonly carryOffsetZ: number;
  /** Counter point under where the carried piece appears, as +z from the finger. */
  readonly dropOffsetZ: number;
  /** Each landed piece rests this much higher than the last, to avoid z-fighting. */
  readonly stackStep: number;
  readonly popDuration: number;
  readonly landDuration: number;
  readonly returnDuration: number;
  readonly hopHeight: number;
}

export const DEFAULT_DRAG_CONFIG: DragConfig = {
  lift: 0.5,
  carryOffsetZ: 0.3,
  dropOffsetZ: 0.72,
  stackStep: 0.003,
  popDuration: 0.12,
  landDuration: 0.32,
  returnDuration: 0.45,
  hopHeight: 0.9,
};

export interface DragEvents {
  grabbed: { sourceId: string };
  placed: { sourceId: string; zoneId: string; position: Vec3; piece: PieceView };
  returned: { sourceId: string };
}

interface ActiveDrag {
  readonly source: DragSource;
  readonly piece: PieceView;
  position: Vec3;
}

/**
 * Drag-and-drop flow over a GrabInput: grab near a source spawns a piece, it
 * follows the input kinematically, and release either lands it on a valid
 * zone with a bounce or hops it home and removes it (X3, X4). No fail states:
 * every input sequence ends with the piece somewhere sensible.
 */
export class DragController {
  private readonly events = new Emitter<DragEvents>();
  private readonly tweens = new TweenRunner();
  private readonly subscriptions: Unsubscribe[];
  private active: ActiveDrag | null = null;
  private placedCount = 0;

  constructor(
    input: GrabInput,
    private sources: readonly DragSource[],
    private zones: readonly DropZone[],
    private readonly config: DragConfig = DEFAULT_DRAG_CONFIG,
  ) {
    this.subscriptions = [
      input.onGrab((e) => this.grab(e.position)),
      input.onMove((e) => this.move(e.position)),
      input.onRelease((e) => this.release(e.position)),
    ];
  }

  get isDragging(): boolean {
    return this.active !== null;
  }

  on<K extends keyof DragEvents>(type: K, handler: (e: DragEvents[K]) => void): Unsubscribe {
    return this.events.on(type, handler);
  }

  /** Replace sources and zones, e.g. after a layout change. */
  setTargets(sources: readonly DragSource[], zones: readonly DropZone[]): void {
    this.sources = sources;
    this.zones = zones;
  }

  update(dt: number): void {
    this.tweens.update(dt);
  }

  dispose(): void {
    this.subscriptions.forEach((off) => off());
    this.active?.piece.dispose();
    this.active = null;
    this.tweens.clear();
    this.events.clear();
  }

  private carryPosition(finger: Vec3): Vec3 {
    return vec3(finger.x, this.config.lift, finger.z + this.config.carryOffsetZ);
  }

  private grab(finger: Vec3): boolean {
    if (this.active) return false;
    const source = pickNearest(
      this.sources.map((s) => ({ item: s, center: s.draggable.home, pickRadius: s.pickRadius })),
      finger,
    );
    if (!source) return false;

    const piece = source.createPiece();
    const position = this.carryPosition(finger);
    piece.setPosition(position);
    piece.setScale(0.4);
    this.tweens.add(this.config.popDuration, (t) => piece.setScale(lerp(0.4, 1, easeOutBack(t))));
    this.active = { source, piece, position };
    this.events.emit('grabbed', { sourceId: source.draggable.id });
    return true;
  }

  private move(finger: Vec3): void {
    if (!this.active) return;
    this.active.position = this.carryPosition(finger);
    this.active.piece.setPosition(this.active.position);
  }

  private release(finger: Vec3): void {
    const drag = this.active;
    if (!drag) return;
    this.active = null;

    const dropPoint = vec3(finger.x, 0, finger.z + this.config.dropOffsetZ);
    const result = resolveDrop(dropPoint, drag.source.draggable, this.zones);
    if (result.kind === 'zone') {
      const landAt = vec3(
        result.landAt.x,
        result.landAt.y + this.placedCount * this.config.stackStep,
        result.landAt.z,
      );
      this.placedCount++;
      this.land(drag, landAt, result.zone.id);
    } else {
      this.returnHome(drag);
    }
  }

  private land(drag: ActiveDrag, landAt: Vec3, zoneId: string): void {
    const from = drag.position;
    const sourceId = drag.source.draggable.id;
    this.tweens.add(
      this.config.landDuration,
      (t) => {
        const slide = easeOutCubic(Math.min(1, t / 0.55));
        drag.piece.setPosition(
          vec3(
            lerp(from.x, landAt.x, slide),
            landAt.y + (from.y - landAt.y) * dropBounce(t),
            lerp(from.z, landAt.z, slide),
          ),
        );
      },
      () => this.events.emit('placed', { sourceId, zoneId, position: landAt, piece: drag.piece }),
    );
  }

  private returnHome(drag: ActiveDrag): void {
    const from = drag.position;
    const home = drag.source.draggable.home;
    const sourceId = drag.source.draggable.id;
    this.tweens.add(
      this.config.returnDuration,
      (t) => {
        const p = lerpVec(from, home, easeInOutQuad(t));
        drag.piece.setPosition(vec3(p.x, p.y + hopArc(t) * this.config.hopHeight, p.z));
        drag.piece.setScale(lerp(1, 0.35, Math.max(0, (t - 0.6) / 0.4)));
      },
      () => {
        drag.piece.dispose();
        this.events.emit('returned', { sourceId });
      },
    );
  }
}
