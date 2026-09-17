import { CAMERA_PITCH } from '../core/counterLayout';
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

/**
 * Something that can be grabbed. With `createPiece` it is a spawner, e.g. a
 * topping bowl that never runs out (G1.2): each grab makes a new piece, and a
 * miss sends the piece home and removes it. With `view` it is an existing
 * object, e.g. a slice, a plate or a tool: a miss sends it home, where it can
 * be grabbed again, and landing it on a zone retires it.
 */
export interface DragSource {
  readonly draggable: Draggable;
  readonly pickRadius: number;
  createPiece?(): PieceView;
  readonly view?: PieceView;
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
  /** Carried things are shown a little bigger so it is obvious what is in hand (P5). */
  readonly carryScale: number;
  readonly popDuration: number;
  readonly landDuration: number;
  readonly returnDuration: number;
  readonly hopHeight: number;
}

/**
 * A carry configuration. The drop point is where the lifted piece appears to
 * be on the counter from the fixed camera, so pieces fall where they look.
 */
export function carryConfig(lift: number, carryOffsetZ: number, overrides: Partial<DragConfig> = {}): DragConfig {
  return {
    lift,
    carryOffsetZ,
    dropOffsetZ: carryOffsetZ + lift / Math.tan(CAMERA_PITCH),
    stackStep: 0,
    carryScale: 1.12,
    popDuration: 0.12,
    landDuration: 0.32,
    returnDuration: 0.45,
    hopHeight: 0.9,
    ...overrides,
  };
}

export const DEFAULT_DRAG_CONFIG: DragConfig = carryConfig(0.5, 0.3, { stackStep: 0.003 });

export interface DragEvents {
  grabbed: { sourceId: string; piece: PieceView };
  /** On grab and every move: `position` is the drop point on the counter, `carried` is the piece itself. */
  moved: { sourceId: string; position: Vec3; carried: Vec3 };
  released: { sourceId: string; piece: PieceView };
  placed: { sourceId: string; zoneId: string; position: Vec3; piece: PieceView };
  returned: { sourceId: string };
}

interface ActiveDrag {
  readonly source: DragSource;
  readonly piece: PieceView;
  position: Vec3;
}

/**
 * Drag-and-drop flow over a GrabInput: grab near a source, the piece follows
 * the input kinematically, and release either lands it on a valid zone with a
 * bounce or hops it home (X3, X4). No fail states: every input sequence ends
 * with the piece somewhere sensible.
 */
export class DragController {
  private readonly events = new Emitter<DragEvents>();
  private readonly tweens = new TweenRunner();
  private readonly subscriptions: Unsubscribe[];
  private readonly occupancy = new Map<string, number>();
  private readonly retired = new Set<string>();
  /** Objects hopping home, with the cancel for that hop so they can be re-grabbed mid-air. */
  private readonly returning = new Map<string, { cancel: () => void; position: () => Vec3 }>();
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

  /** Send any carried piece home and jump every tween to its end, so nothing is left mid-air. */
  finishAll(): void {
    if (this.active) this.release(null);
    this.tweens.finishAll();
  }

  dispose(): void {
    this.subscriptions.forEach((off) => off());
    if (this.active?.source.createPiece) this.active.piece.dispose();
    this.active = null;
    this.tweens.clear();
    this.events.clear();
  }

  private carryPosition(finger: Vec3): Vec3 {
    return vec3(finger.x, this.config.lift, finger.z + this.config.carryOffsetZ);
  }

  private dropPoint(finger: Vec3): Vec3 {
    return vec3(finger.x, 0, finger.z + this.config.dropOffsetZ);
  }

  private grab(finger: Vec3): boolean {
    if (this.active) return false;
    const source = pickNearest(
      this.sources
        .filter((s) => !this.retired.has(s.draggable.id))
        .flatMap((s) => {
          // An object hopping home can be caught where it is, or where it is going.
          const inFlight = this.returning.get(s.draggable.id)?.position();
          const centers = inFlight ? [inFlight, s.draggable.home] : [s.draggable.home];
          return centers.map((center) => ({ item: s, center, pickRadius: s.pickRadius }));
        }),
      finger,
    );
    if (!source) return false;
    const sourceId = source.draggable.id;

    const position = this.carryPosition(finger);
    let piece: PieceView;
    if (source.createPiece) {
      piece = source.createPiece();
      piece.setScale(0.4);
    } else if (source.view) {
      piece = source.view;
      this.returning.get(sourceId)?.cancel();
      this.returning.delete(sourceId);
      piece.setScale(1);
    } else {
      return false;
    }
    const fromScale = source.createPiece ? 0.4 : 1;
    const carryScale = this.config.carryScale;
    this.tweens.add(this.config.popDuration, (t) => piece.setScale(lerp(fromScale, carryScale, easeOutBack(t))));
    piece.setPosition(position);
    this.active = { source, piece, position };
    this.events.emit('grabbed', { sourceId, piece });
    this.events.emit('moved', { sourceId, position: this.dropPoint(finger), carried: position });
    return true;
  }

  private move(finger: Vec3): void {
    if (!this.active) return;
    this.active.position = this.carryPosition(finger);
    this.active.piece.setPosition(this.active.position);
    this.events.emit('moved', {
      sourceId: this.active.source.draggable.id,
      position: this.dropPoint(finger),
      carried: this.active.position,
    });
  }

  /** `finger` is null when the drag is abandoned, which always sends the piece home. */
  private release(finger: Vec3 | null): void {
    const drag = this.active;
    if (!drag) return;
    this.active = null;
    this.events.emit('released', { sourceId: drag.source.draggable.id, piece: drag.piece });

    const result = finger
      ? resolveDrop(this.dropPoint(finger), drag.source.draggable, this.zones, this.occupancy)
      : ({ kind: 'home' } as const);
    if (result.kind === 'zone') {
      const landAt = vec3(
        result.landAt.x,
        result.landAt.y + this.placedCount * this.config.stackStep,
        result.landAt.z,
      );
      this.placedCount++;
      this.occupancy.set(result.zone.id, (this.occupancy.get(result.zone.id) ?? 0) + 1);
      if (drag.source.view) this.retired.add(drag.source.draggable.id);
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
        drag.piece.setScale(lerp(this.config.carryScale, 1, slide));
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
    const spawned = drag.source.createPiece !== undefined;
    let current = from;
    const cancel = this.tweens.add(
      this.config.returnDuration,
      (t) => {
        const p = lerpVec(from, home, easeInOutQuad(t));
        current = vec3(p.x, p.y + hopArc(t) * this.config.hopHeight, p.z);
        drag.piece.setPosition(current);
        const shrink = Math.max(0, (t - 0.6) / 0.4);
        drag.piece.setScale(lerp(this.config.carryScale, spawned ? 0.35 : 1, spawned ? shrink : t));
      },
      () => {
        if (spawned) drag.piece.dispose();
        else this.returning.delete(sourceId);
        this.events.emit('returned', { sourceId });
      },
    );
    if (!spawned) this.returning.set(sourceId, { cancel, position: () => current });
  }
}
