import '@babylonjs/core/Meshes/instancedMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { BOWL_RADIUS, bowlPosition, type CounterLayout } from '../../core/counterLayout';
import type { Unsubscribe } from '../../core/events';
import type { Stage } from '../../core/Stage';
import { lerp, vec3, type Vec3 } from '../../core/vec';
import toppingData from '../../data/toppings.json';
import {
  DEFAULT_DRAG_CONFIG,
  DragController,
  type DragSource,
  type PieceView,
} from '../../interact/DragController';
import { TweenRunner, easeOutBack } from '../../interact/tween';
import { createBasedCylinder, flatMaterial } from '../shared/greybox';
import type { StageContext } from '../StageContext';

interface ToppingDef {
  readonly id: string;
  readonly bowlColor: string;
  readonly pieceColor: string;
  readonly bowlX: number;
  readonly bowlArcZ: number;
  readonly validZones: readonly string[];
}

const TOPPINGS: readonly ToppingDef[] = toppingData;

const BOWL_HEIGHT = 0.35;
const PIECE_RADIUS = 0.28;
const PIECE_HEIGHT = 0.08;
/** Grab radius as a multiple of the visible bowl, so a near miss still grabs (P3). */
const PICK_RADIUS_FACTOR = 1.5;

interface Bowl {
  readonly def: ToppingDef;
  readonly mesh: Mesh;
  /** Hidden source mesh; every piece of this topping is an instance of it. */
  readonly pieceSource: Mesh;
}

class InstancePieceView implements PieceView {
  constructor(
    private readonly mesh: InstancedMesh,
    private readonly baseScale: number,
  ) {}

  setPosition(p: Vec3): void {
    this.mesh.position.set(p.x, p.y, p.z);
  }

  setScale(s: number): void {
    this.mesh.scaling.setAll(s * this.baseScale);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}

/** Stage 1: drag toppings from never-empty bowls onto the pizza (G1.1 to G1.4). */
export class ToppingsStage implements Stage<StageContext> {
  readonly id = 'toppings';

  private ctx: StageContext | null = null;
  private controller: DragController | null = null;
  private readonly tweens = new TweenRunner();
  private bowls: Bowl[] = [];
  private pieces: PieceView[] = [];
  private subscriptions: Unsubscribe[] = [];
  private pieceCounter = 0;

  enter(ctx: StageContext): void {
    this.ctx = ctx;
    this.bowls = TOPPINGS.map((def) => this.createBowl(ctx, def));

    const layout = ctx.layout();
    this.placeBowls(layout);
    const controller = new DragController(ctx.input, this.createSources(layout), [ctx.pizzaZone]);
    this.controller = controller;

    this.subscriptions = [
      controller.on('grabbed', ({ sourceId }) => this.squashBowl(sourceId)),
      controller.on('placed', ({ piece }) => this.pieces.push(piece)),
      ctx.onLayoutChanged((next) => {
        this.placeBowls(next);
        controller.setTargets(this.createSources(next), [ctx.pizzaZone]);
      }),
    ];
  }

  exit(): void {
    this.subscriptions.forEach((off) => off());
    this.subscriptions = [];
    this.controller?.dispose();
    this.controller = null;
    this.tweens.clear();
    this.pieces.forEach((piece) => piece.dispose());
    this.pieces = [];
    for (const bowl of this.bowls) {
      bowl.pieceSource.dispose(false, true);
      bowl.mesh.dispose(false, true);
    }
    this.bowls = [];
    this.ctx = null;
  }

  update(dt: number): void {
    this.controller?.update(dt);
    this.tweens.update(dt);
  }

  private createBowl(ctx: StageContext, def: ToppingDef): Bowl {
    const { scene } = ctx;
    const mesh = createBasedCylinder(scene, `bowl-${def.id}`, {
      height: BOWL_HEIGHT,
      diameterTop: BOWL_RADIUS * 2,
      diameterBottom: BOWL_RADIUS * 1.4,
    });
    mesh.material = flatMaterial(scene, `bowlMat-${def.id}`, def.bowlColor);

    const pieceMaterial = flatMaterial(scene, `pieceMat-${def.id}`, def.pieceColor);

    // A disc of the topping colour shows what is in the bowl.
    const contents = createBasedCylinder(scene, `bowlContents-${def.id}`, {
      height: 0.04,
      diameterTop: BOWL_RADIUS * 1.7,
    });
    contents.material = pieceMaterial;
    contents.parent = mesh;
    contents.position.y = BOWL_HEIGHT;

    const pieceSource = createBasedCylinder(scene, `piece-${def.id}`, {
      height: PIECE_HEIGHT,
      diameterTop: PIECE_RADIUS * 2,
      tessellation: 20,
    });
    pieceSource.material = pieceMaterial;
    pieceSource.isVisible = false;

    return { def, mesh, pieceSource };
  }

  private placeBowls(layout: CounterLayout): void {
    for (const bowl of this.bowls) {
      const p = bowlPosition(bowl.def.bowlX, bowl.def.bowlArcZ, layout.targetScale);
      bowl.mesh.position.set(p.x, p.y, p.z);
      bowl.mesh.scaling.setAll(layout.targetScale);
    }
  }

  private createSources(layout: CounterLayout): DragSource[] {
    const scale = layout.targetScale;
    return this.bowls.map((bowl) => {
      const p = bowlPosition(bowl.def.bowlX, bowl.def.bowlArcZ, scale);
      return {
        draggable: {
          id: bowl.def.id,
          home: vec3(p.x, BOWL_HEIGHT * scale, p.z),
          validZones: bowl.def.validZones,
        },
        pickRadius: BOWL_RADIUS * scale * PICK_RADIUS_FACTOR,
        createPiece: () => {
          const instance = bowl.pieceSource.createInstance(`${bowl.def.id}-${this.pieceCounter++}`);
          instance.isPickable = false;
          return new InstancePieceView(instance, scale);
        },
      };
    });
  }

  /** Immediate visual answer to a grab (P5): the bowl dips and springs back. */
  private squashBowl(sourceId: string): void {
    const bowl = this.bowls.find((b) => b.def.id === sourceId);
    const scale = this.ctx?.layout().targetScale ?? 1;
    if (!bowl) return;
    bowl.mesh.scaling.y = scale * 0.7;
    this.tweens.add(DEFAULT_DRAG_CONFIG.popDuration * 2, (t) => {
      bowl.mesh.scaling.y = scale * lerp(0.7, 1, easeOutBack(t));
    });
  }
}
