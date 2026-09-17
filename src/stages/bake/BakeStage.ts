import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { PIZZA_CENTER, PIZZA_RADIUS, PLAY_AREA } from '../../core/counterLayout';
import { lerp, vec3 } from '../../core/vec';
import { carryConfig, type DragSource } from '../../interact/DragController';
import type { DropZone } from '../../interact/DropZone';
import { easeOutCubic } from '../../interact/tween';
import { BaseStage } from '../shared/BaseStage';
import { flatMaterial } from '../shared/greybox';
import { createOven, type OvenProp } from '../shared/props';

const OVEN_SIZE = PIZZA_RADIUS * 2 + 0.3;
const OVEN_HEIGHT = 0.9;
const OVEN_X = 2.75;
const OFFSTAGE_X = PLAY_AREA.maxX + OVEN_SIZE;
const PIZZA_START_X = -2.4;

/**
 * Stage 2: push the pizza into the oven and watch it bake through the glass
 * top. It cannot burn and there is no timing to get right (G2.4).
 */
export class BakeStage extends BaseStage {
  readonly id = 'bake';
  private glowTime = 0;
  private baking: OvenProp | null = null;

  protected onEnter(): void {
    const { scene, pizza } = this.ctx;
    this.baking = null;
    this.glowTime = 0;

    const oven = createOven(scene, OVEN_SIZE, OVEN_HEIGHT);
    this.own(oven.node);
    oven.node.position.set(OFFSTAGE_X, 0, PIZZA_CENTER.z);
    oven.door.scaling.y = 0.02;
    oven.door.position.y = 0.01;

    // The pizza makes room and the oven rolls in; then it is the child's turn.
    const start = vec3(PIZZA_START_X, 0, PIZZA_CENTER.z);
    this.slide(pizza.root, start, 0.5);
    this.slide(oven.node, { x: OVEN_X, z: PIZZA_CENTER.z }, 0.5, () => this.enableDrag(oven, start));
  }

  private enableDrag(oven: OvenProp, start: ReturnType<typeof vec3>): void {
    const { pizza } = this.ctx;
    const zone: DropZone = {
      id: 'oven',
      center: vec3(OVEN_X, 0, PIZZA_CENTER.z),
      // Wide snap zone (G2.1): any decent push towards the oven counts.
      acceptRadius: OVEN_X - PIZZA_START_X - 1.1,
      landRadius: 0,
      surfaceY: 0,
      capacity: 1,
    };
    const source: DragSource = {
      draggable: { id: 'pizza', home: start, validZones: ['oven'] },
      pickRadius: PIZZA_RADIUS + 0.4,
      view: pizza.view,
    };
    const controller = this.drag([source], [zone], carryConfig(0.04, 0, { landDuration: 0.55, hopHeight: 0.15 }));
    this.listen(
      controller.on('placed', () => {
        this.stopDrag(controller);
        this.bake(oven);
      }),
    );
  }

  private bake(oven: OvenProp): void {
    const { pizza, config } = this.ctx;
    const door = (from: number, to: number, then: () => void): void => {
      this.tweens.add(
        0.4,
        (t) => {
          oven.door.scaling.y = lerp(from, to, easeOutCubic(t));
          oven.door.position.y = (OVEN_HEIGHT * oven.door.scaling.y) / 2;
        },
        then,
      );
    };

    door(0.02, 1, () => {
      this.baking = oven;
      this.tweens.add(
        config.bakeSeconds,
        (t) => pizza.setBaked(t),
        () => {
          this.baking = null;
          oven.glass.emissiveColor.set(0.25, 0.1, 0);
          door(1, 0.02, () => {
            this.slide(pizza.root, pizza.home, 0.8, () => {
              this.steam();
              this.slide(oven.node, { x: OFFSTAGE_X, z: PIZZA_CENTER.z }, 0.5);
              this.finish(1.2);
            });
          });
        },
      );
    });
  }

  override update(dt: number): void {
    super.update(dt);
    // Something to watch while it bakes (P6): the glass glows in a slow, soft pulse (N7).
    if (this.baking) {
      this.glowTime += dt;
      const glow = 0.45 + 0.2 * Math.sin(this.glowTime * 2.5);
      this.baking.glass.emissiveColor.set(glow, glow * 0.45, 0);
    }
  }

  /** A few soft puffs rising off the baked pizza (G2.5). */
  private steam(): void {
    const { scene, pizza } = this.ctx;
    const material = flatMaterial(scene, 'steamMat', '#ffffff', true);
    material.alpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const puff = this.own(CreateSphere(`steam-${i}`, { diameter: 0.5, segments: 8 }, scene));
      puff.material = material;
      puff.isPickable = false;
      const x = pizza.home.x + (i - 2) * 0.5;
      const z = pizza.home.z + (i % 2 === 0 ? 0.3 : -0.3);
      puff.position.set(x, 0.3, z);
      this.tweens.add(1.2, (t) => {
        puff.position.y = 0.3 + t * 1.4;
        puff.scaling.setAll(1 + t);
        puff.visibility = 1 - t;
      });
    }
  }
}
