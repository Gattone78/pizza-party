import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { clamp, distXZ, lerp, type Vec3 } from '../../core/vec';
import { easeInOutQuad, hopArc, type TweenRunner } from '../../interact/tween';
import { createBasedCylinder, flatMaterial } from './greybox';

/** What to show the child: a motion from one place to another, and where it ends. */
export interface Hint {
  readonly from: Vec3;
  readonly to: Vec3;
  /** Glowing ring on the target. */
  readonly ring?: { readonly center: Vec3; readonly radius: number };
  /** Spoken prompt to repeat with the hint (A5). */
  readonly prompt?: string;
}

const HOVER = 0.75;
const DURATION = 2.2;

/**
 * The one hint language used everywhere (A8): a glowing ring on the target
 * and a ghost hand showing the motion. Slow and soft, never flashing (N7).
 */
export class HintLayer {
  private readonly hand: TransformNode;
  private readonly handMeshes: Mesh[];
  private readonly ring: Mesh;
  private cancelTween: (() => void) | null = null;

  constructor(scene: Scene) {
    const glove = flatMaterial(scene, 'hintHandMat', '#ffffff', true);
    glove.emissiveColor.set(0.55, 0.55, 0.55);

    this.hand = new TransformNode('hintHand', scene);
    this.hand.scaling.setAll(1.3);
    const palm = CreateSphere('hintPalm', { diameter: 0.6, segments: 10 }, scene);
    palm.scaling.set(1, 0.55, 1.1);
    const finger = createBasedCylinder(scene, 'hintFinger', { height: 0.5, diameterTop: 0.16, tessellation: 10 });
    // Pointing away from the camera and down at the counter.
    finger.rotation.x = 1.9;
    finger.position.set(-0.12, 0, 0.2);
    const thumb = createBasedCylinder(scene, 'hintThumb', { height: 0.28, diameterTop: 0.15, tessellation: 10 });
    thumb.rotation.z = 1.2;
    thumb.position.set(-0.2, 0, -0.05);
    this.handMeshes = [palm, finger, thumb];
    for (const mesh of this.handMeshes) {
      mesh.material = glove;
      mesh.isPickable = false;
      mesh.parent = this.hand;
    }

    const ringMaterial = flatMaterial(scene, 'hintRingMat', '#ffe066', true);
    ringMaterial.emissiveColor.set(0.8, 0.7, 0.2);
    this.ring = CreateTorus('hintRing', { diameter: 2, thickness: 0.09, tessellation: 40 }, scene);
    this.ring.material = ringMaterial;
    this.ring.isPickable = false;

    this.hide();
  }

  play(hint: Hint, tweens: TweenRunner): void {
    this.cancel();
    const isTap = distXZ(hint.from, hint.to) < 0.2;
    this.hand.setEnabled(true);
    if (hint.ring) {
      this.ring.setEnabled(true);
      // High enough to sit on top of the pizza or a plate rather than inside it.
      this.ring.position.set(hint.ring.center.x, 0.24, hint.ring.center.z);
      this.ring.scaling.set(hint.ring.radius, 1, hint.ring.radius);
    }

    this.cancelTween = tweens.add(
      DURATION,
      (t) => {
        const fade = clamp(Math.min(t / 0.15, (1 - t) / 0.15), 0, 1);
        const travel = easeInOutQuad(clamp((t - 0.15) / 0.6, 0, 1));
        // A tap hint dips twice on the spot; a drag hint arcs across.
        const y = isTap ? HOVER - hopArc((t * 2) % 1) * 0.45 : HOVER + hopArc(travel) * 0.5;
        this.hand.position.set(lerp(hint.from.x, hint.to.x, travel), y, lerp(hint.from.z, hint.to.z, travel));
        for (const mesh of this.handMeshes) mesh.visibility = fade * 0.8;
        this.ring.visibility = fade * (0.6 + 0.3 * Math.sin(t * Math.PI * 4));
      },
      () => this.hide(),
    );
  }

  /** The child is doing something: get out of the way at once. */
  cancel(): void {
    this.cancelTween?.();
    this.hide();
  }

  dispose(): void {
    this.cancel();
    this.hand.dispose();
    this.ring.dispose();
  }

  private hide(): void {
    this.cancelTween = null;
    this.hand.setEnabled(false);
    this.ring.setEnabled(false);
  }
}
