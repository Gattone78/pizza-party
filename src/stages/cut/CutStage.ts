import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { FRONT_CENTER, PIZZA_RADIUS } from '../../core/counterLayout';
import { lerp, vec3 } from '../../core/vec';
import { CutTracker, guideAngle, sliceOffset } from '../../interact/CutTracker';
import { carryConfig, type DragSource } from '../../interact/DragController';
import { easeOutCubic } from '../../interact/tween';
import { BaseStage } from '../shared/BaseStage';
import { NodeView, flatMaterial } from '../shared/greybox';
import type { Hint } from '../shared/HintLayer';
import type { PizzaSlice } from '../shared/Pizza';
import { createWheel } from '../../art/props';

/** How far slices part along each cut (G3.4). */
const CUT_GAP = 0.09;

/**
 * Stage 3: roll the wheel across the glowing guide lines. Touching anywhere
 * brings the wheel to the finger, so a plain swipe across the pizza works too,
 * and any swipe near a guide snaps to a clean cut (G3.2).
 */
export class CutStage extends BaseStage {
  readonly id = 'cut';
  private guides: Mesh[] = [];
  private glowTime = 0;
  private tracker: CutTracker | null = null;

  /** Swipe the hand along the next guide that still needs cutting. */
  protected override hint(): Hint | null {
    const tracker = this.tracker;
    if (!tracker || tracker.done) return null;
    const guides = Array.from({ length: tracker.cuts }, (_, i) => i);
    const a = guideAngle(guides.find((i) => !tracker.completed.has(i)) ?? 0, tracker.cuts);
    const c = this.ctx.pizza.home;
    const reach = PIZZA_RADIUS * 1.05;
    return {
      from: vec3(c.x - Math.cos(a) * reach, 0, c.z - Math.sin(a) * reach),
      to: vec3(c.x + Math.cos(a) * reach, 0, c.z + Math.sin(a) * reach),
    };
  }

  protected onEnter(): void {
    const { scene, pizza, config } = this.ctx;
    const scale = this.ctx.layout().targetScale;
    const slices = pizza.slice(config.cuts);
    const tracker = new CutTracker(config.cuts, PIZZA_RADIUS);
    this.tracker = tracker;
    this.glowTime = 0;

    const guideMaterial = flatMaterial(scene, 'guideMat', '#fff3a0', true);
    guideMaterial.emissiveColor.set(0.6, 0.55, 0.2);
    this.guides = Array.from({ length: config.cuts }, (_, index) => {
      const guide = this.own(
        CreateBox(`guide-${index}`, { width: PIZZA_RADIUS * 2.15, depth: 0.1, height: 0.02 }, scene),
      );
      guide.isPickable = false;
      guide.material = guideMaterial;
      guide.parent = pizza.root;
      guide.position.y = 0.2;
      // Babylon's y rotation runs from +x towards -z, the opposite of the guide angle.
      guide.rotation.y = -guideAngle(index, config.cuts);
      return guide;
    });

    const wheel = this.own(createWheel(scene));
    wheel.position.set(FRONT_CENTER.x, 0, FRONT_CENTER.z);
    this.popIn(wheel, scale);
    const source: DragSource = {
      draggable: { id: 'wheel', home: FRONT_CENTER, validZones: [] },
      // The whole counter grabs the wheel.
      pickRadius: 100,
      view: new NodeView(wheel, scale, false),
    };
    const controller = this.drag([source], [], carryConfig(0.15, 0.2, { carryScale: 1 }), {
      sounds: { grabbed: 'grab' },
    });
    this.announce('cut');

    const cut = (index: number): void => {
      this.guides[index]?.setEnabled(false);
      this.ctx.audio.play('slice');
      this.ctx.audio.buzz();
      this.part(slices, tracker);
      if (tracker.done) {
        this.stopDrag(controller);
        this.finish(0.9);
      }
    };
    this.listen(controller.on('moved', ({ position }) => tracker.track(pizza.toLocal(position)).forEach(cut)));
    this.listen(
      controller.on('released', () => {
        const snapped = tracker.endStroke();
        if (snapped !== null) cut(snapped);
      }),
    );
  }

  override update(dt: number): void {
    super.update(dt);
    // Guides breathe slowly so they read as "here" without flashing (N7).
    this.glowTime += dt;
    const glow = 0.55 + 0.25 * Math.sin(this.glowTime * 2.5);
    for (const guide of this.guides) guide.visibility = glow + 0.2;
  }

  protected override onExit(): void {
    this.tracker = null;
    this.guides = [];
  }

  private part(slices: readonly PizzaSlice[], tracker: CutTracker): void {
    for (const slice of slices) {
      const offset = sliceOffset(slice.index, tracker.cuts, tracker.completed, CUT_GAP);
      const fromX = slice.node.position.x;
      const fromZ = slice.node.position.z;
      this.tweens.add(0.25, (t) => {
        const e = easeOutCubic(t);
        slice.node.position.x = lerp(fromX, slice.rest.x + offset.x, e);
        slice.node.position.z = lerp(fromZ, slice.rest.z + offset.z, e);
      });
    }
  }
}
