import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Unsubscribe } from '../../core/events';
import { distXZ, type Vec3 } from '../../core/vec';
import type { DragController } from '../../interact/DragController';
import type { TweenRunner } from '../../interact/tween';
import { blobShadow } from '../../art/build';
import { NodeView, createBasedCylinder, flatMaterial } from './greybox';

export interface CarryEffectOptions {
  /** Radius of the white halo under a carried piece from this source, or null for none. */
  readonly halo?: (sourceId: string) => number | null;
}

const SPARK_SPACING = 0.3;
const SPARK_LIFE = 0.55;

/**
 * Makes it obvious what is in hand, as in the art reference: a white halo
 * that reads as an outline from the fixed camera, and a soft trail of
 * sparkles. Slow fades only, nothing that flashes (N7).
 */
export class CarryEffects {
  private readonly halo: Mesh;
  private readonly spark: Mesh;
  /** Falls where the piece will land, which shows a toddler where to let go. */
  private readonly shadow: InstancedMesh;
  private readonly subscriptions: Unsubscribe[];
  private lastSpark: Vec3 | null = null;
  private sparkCount = 0;

  constructor(scene: Scene, controller: DragController, tweens: TweenRunner, options: CarryEffectOptions = {}) {
    const white = flatMaterial(scene, 'haloMat', '#ffffff', true);
    white.emissiveColor.set(0.9, 0.9, 0.9);
    this.halo = createBasedCylinder(scene, 'carryHalo', { height: 0.02, diameterTop: 2, tessellation: 28 });
    this.halo.material = white;
    this.halo.setEnabled(false);

    const gold = flatMaterial(scene, 'sparkMat', '#fff2a8', true);
    gold.emissiveColor.set(0.9, 0.85, 0.5);
    this.spark = CreateBox('carrySpark', { size: 0.13 }, scene);
    this.spark.material = gold;
    this.spark.isPickable = false;
    this.spark.isVisible = false;

    this.shadow = blobShadow(scene, 0.45);
    this.shadow.setEnabled(false);

    this.subscriptions = [
      controller.on('grabbed', ({ sourceId, piece }) => {
        this.lastSpark = null;
        this.shadow.setEnabled(true);
        const radius = options.halo?.(sourceId) ?? null;
        if (radius === null || !(piece instanceof NodeView)) return;
        this.halo.parent = piece.node;
        this.halo.position.set(0, -0.03, 0);
        this.halo.scaling.set(radius, 1, radius);
        this.halo.setEnabled(true);
      }),
      controller.on('released', () => {
        this.shadow.setEnabled(false);
        this.halo.parent = null;
        this.halo.setEnabled(false);
      }),
      controller.on('moved', ({ carried, position }) => {
        // Just above the pizza's surface, so it shows on the counter and on the pizza alike.
        this.shadow.position.set(position.x, 0.17, position.z);
        if (this.lastSpark && distXZ(this.lastSpark, carried) < SPARK_SPACING) return;
        this.lastSpark = carried;
        const spark = this.spark.createInstance(`spark-${this.sparkCount++}`);
        spark.isPickable = false;
        const x = carried.x + (Math.random() - 0.5) * 0.5;
        const z = carried.z + (Math.random() - 0.5) * 0.5 - 0.25;
        const spin = Math.random() * Math.PI;
        tweens.add(
          SPARK_LIFE,
          (t) => {
            spark.position.set(x, carried.y + 0.1 + t * 0.35, z);
            spark.rotation.set(spin + t * 2, Math.PI / 4, Math.PI / 4);
            spark.scaling.setAll(Math.sin(Math.PI * Math.min(1, t * 1.1)));
          },
          () => spark.dispose(),
        );
      }),
    ];
  }

  dispose(): void {
    this.subscriptions.forEach((off) => off());
    this.halo.parent = null;
    this.halo.dispose();
    this.shadow.dispose();
    // Disposing the source also removes any sparks still fading.
    this.spark.dispose();
  }
}
