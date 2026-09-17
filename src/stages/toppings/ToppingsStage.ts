import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  BOWL_RADIUS,
  FRONT_CENTER,
  PIZZA_RADIUS,
  bowlSlotPosition,
  type CounterLayout,
} from '../../core/counterLayout';
import { distXZ, vec3 } from '../../core/vec';
import toppingData from '../../data/toppings.json';
import { DEFAULT_DRAG_CONFIG, type DragSource } from '../../interact/DragController';
import { BaseStage } from '../shared/BaseStage';
import { NodeView, flatMaterial } from '../shared/greybox';
import type { Hint } from '../shared/HintLayer';
import { BOWL_HEIGHT, createBell, createBowl, createPieceSource, type PieceShape } from '../shared/props';

interface ToppingDef {
  readonly id: string;
  readonly slot: number;
  readonly color: string;
  readonly shape: string;
  readonly size: number;
  readonly validZones: readonly string[];
}

const TOPPINGS: readonly ToppingDef[] = toppingData;

/** Grab radius as a multiple of the visible bowl, so a near miss still grabs (P3). */
const PICK_RADIUS_FACTOR = 1.5;
const MAX_BELL_SCALE = 1.2;

interface Bowl {
  readonly def: ToppingDef;
  readonly mesh: Mesh;
  /** Hidden source mesh; every piece of this topping is an instance of it. */
  readonly pieceSource: Mesh;
}

/** Stage 1: drag toppings from never-empty bowls onto the pizza, then ring the bell (G1.1 to G1.6). */
export class ToppingsStage extends BaseStage {
  readonly id = 'toppings';

  private bowls: Bowl[] = [];
  private bell: { node: TransformNode; material: StandardMaterial } | null = null;
  private placed = 0;
  private rung = false;
  private glowTime = 0;
  private pieceCounter = 0;

  protected onEnter(): void {
    const { scene, pizza } = this.ctx;
    this.placed = 0;
    this.rung = false;
    this.glowTime = 0;

    this.bowls = TOPPINGS.map((def) => {
      const material = flatMaterial(scene, `toppingMat-${def.id}`, def.color);
      const mesh = this.own(createBowl(scene, def.id, material));
      const pieceSource = createPieceSource(scene, `piece-${def.id}`, def.shape as PieceShape, def.size);
      pieceSource.material = material;
      pieceSource.isVisible = false;
      // Landed pieces are instances of this mesh, so it has to outlive the stage.
      pizza.keepAlive(pieceSource);
      return { def, mesh, pieceSource };
    });

    this.bell = createBell(scene);
    this.own(this.bell.node);
    this.bell.material.emissiveColor = Color3.Black();

    const layout = this.ctx.layout();
    this.place(layout, true);
    const controller = this.drag(this.createSources(layout), [pizza.zone], DEFAULT_DRAG_CONFIG, {
      effects: {
        halo: (sourceId) => (TOPPINGS.find((t) => t.id === sourceId)?.size ?? 0.3) * 1.4,
      },
    });
    this.announce('toppings');

    this.listen(
      controller.on('grabbed', ({ sourceId }) => {
        const bowl = this.bowls.find((b) => b.def.id === sourceId);
        if (bowl) this.squash(bowl.mesh, this.ctx.layout().targetScale);
      }),
    );
    this.listen(
      controller.on('placed', ({ piece }) => {
        if (piece instanceof NodeView) pizza.addTopping(piece.node);
        this.placed++;
      }),
    );
    this.listen(
      this.ctx.onLayoutChanged((next) => {
        this.place(next, false);
        controller.setTargets(this.createSources(next), [pizza.zone]);
      }),
    );

    // The bell is a tap target, not a draggable: touching it is the one big obvious action (P4).
    this.listen(
      this.ctx.input.onGrab(({ position }) => {
        const scale = this.ctx.layout().targetScale;
        if (controller.isDragging || distXZ(position, FRONT_CENTER) > BOWL_RADIUS * scale * 1.6) return false;
        if (this.rung) return true;
        this.rung = true;
        this.ctx.audio.play('bell');
        this.ctx.audio.buzz();
        if (this.bell) this.squash(this.bell.node, Math.min(scale, MAX_BELL_SCALE));
        // Let pieces still in the air land before the pizza moves on.
        this.tweens.delay(0.25, () => {
          this.stopDrag(controller);
          this.finish();
        });
        return true;
      }),
    );
  }

  /** First show how toppings work; once there are some, show the bell (G1.6). */
  protected override hint(): Hint | null {
    if (this.rung) return null;
    if (this.placed > 0) {
      const scale = Math.min(this.ctx.layout().targetScale, MAX_BELL_SCALE);
      return {
        from: FRONT_CENTER,
        to: FRONT_CENTER,
        ring: { center: FRONT_CENTER, radius: BOWL_RADIUS * scale * 1.25 },
        prompt: 'bell',
      };
    }
    const bowl = this.bowls[Math.floor(Math.random() * this.bowls.length)];
    if (!bowl) return null;
    const { zone } = this.ctx.pizza;
    return {
      from: bowlSlotPosition(bowl.def.slot),
      to: zone.center,
      ring: { center: zone.center, radius: PIZZA_RADIUS },
    };
  }

  override update(dt: number): void {
    super.update(dt);
    // After the first topping the bell glows with a slow, soft pulse (G1.6, N7).
    if (this.placed > 0 && this.bell) {
      this.glowTime += dt;
      const glow = 0.18 + 0.14 * Math.sin(this.glowTime * 2.2);
      this.bell.material.emissiveColor.set(glow, glow * 0.7, 0);
    }
  }

  protected override onExit(): void {
    this.bowls = [];
    this.bell = null;
  }

  private place(layout: CounterLayout, animate: boolean): void {
    const scale = layout.targetScale;
    for (const bowl of this.bowls) {
      const p = bowlSlotPosition(bowl.def.slot);
      bowl.mesh.position.set(p.x, 0, p.z);
      if (animate) this.popIn(bowl.mesh, scale);
      else bowl.mesh.scaling.setAll(scale);
    }
    if (this.bell) {
      // The bell is already big, and must not crowd the pizza on phones.
      const bellScale = Math.min(scale, MAX_BELL_SCALE);
      this.bell.node.position.set(FRONT_CENTER.x, 0, FRONT_CENTER.z);
      if (animate) this.popIn(this.bell.node, bellScale);
      else this.bell.node.scaling.setAll(bellScale);
    }
  }

  private createSources(layout: CounterLayout): DragSource[] {
    const scale = layout.targetScale;
    return this.bowls.map((bowl) => {
      const p = bowlSlotPosition(bowl.def.slot);
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
          return new NodeView(instance, scale);
        },
      };
    });
  }
}
