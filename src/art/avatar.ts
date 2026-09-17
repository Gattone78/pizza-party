import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { ball, blobShadow, lathe, merge, place, puck, ring } from './build';
import { PALETTE } from './palette';

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'balding';

/** One entry in family.json. Adding a person needs no code (A4, X5). */
export interface DinerLook {
  readonly id: string;
  readonly body: string;
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle?: string;
  readonly glasses?: boolean;
  /** 1 is an adult; children are smaller. */
  readonly size?: number;
}

export interface Avatar {
  readonly node: TransformNode;
  /** Nods and tilts separately from the body, for eating and idling. */
  readonly head: TransformNode;
}

const HEAD_Y = 1.08;
const HEAD = 0.78;

function hair(scene: Scene, style: string, color: string): Mesh[] {
  const cap = (sy: number, y: number, z = 0.05): Mesh => place(ball(scene, color, HEAD * 1.08, 14), { y, z, sy });
  switch (style as HairStyle) {
    case 'long':
      return [
        cap(0.6, 0.17),
        place(puck(scene, color, { radius: HEAD * 0.54, height: 0.62, topRadius: HEAD * 0.5 }), { y: -0.5, z: 0.12 }),
      ];
    case 'bun':
      return [cap(0.58, 0.17), place(ball(scene, color, 0.36, 10), { y: 0.5, z: 0.12 })];
    case 'curly':
      return [
        cap(0.5, 0.2),
        ...Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return place(ball(scene, color, 0.32, 8), { x: Math.cos(a) * 0.3, y: 0.3, z: Math.sin(a) * 0.3 + 0.04 });
        }),
      ];
    case 'balding':
      return [place(ring(scene, color, HEAD * 0.98, 0.2, 18), { y: 0.05, z: 0.07 })];
    default:
      return [cap(0.55, 0.18)];
  }
}

/**
 * A family member as a chunky peg doll, told apart by hair, skin tone,
 * glasses and clothing colour rather than a realistic face (A4). All share
 * one build and the same three code-driven animations.
 */
export function createAvatar(scene: Scene, look: DinerLook): Avatar {
  const node = new TransformNode(`diner-${look.id}`, scene);
  node.scaling.setAll(look.size ?? 1);
  blobShadow(scene, 0.75).parent = node;

  const body = merge(`dinerBody-${look.id}`, [
    lathe(scene, look.body, [
      [0, 0],
      [0.5, 0],
      [0.54, 0.08],
      [0.4, 0.6],
      [0.3, 0.76],
      [0, 0.78],
    ]),
    // Little arms resting on the counter, towards the camera.
    place(ball(scene, look.skin, 0.24, 8), { x: -0.34, y: 0.3, z: -0.42 }),
    place(ball(scene, look.skin, 0.24, 8), { x: 0.34, y: 0.3, z: -0.42 }),
  ]);
  body.parent = node;

  const head = new TransformNode(`dinerHead-${look.id}`, scene);
  head.parent = node;
  head.position.y = HEAD_Y;

  // The face looks at the camera, which is on the -z side and above.
  const face: Mesh[] = [
    ball(scene, look.skin, HEAD, 16),
    place(ball(scene, PALETTE.eye, 0.1, 8), { x: -0.15, y: 0.06, z: -0.35 }),
    place(ball(scene, PALETTE.eye, 0.1, 8), { x: 0.15, y: 0.06, z: -0.35 }),
    place(ball(scene, PALETTE.cheek, 0.13, 8), { x: -0.26, y: -0.07, z: -0.29, sz: 0.4 }),
    place(ball(scene, PALETTE.cheek, 0.13, 8), { x: 0.26, y: -0.07, z: -0.29, sz: 0.4 }),
    place(ball(scene, PALETTE.smile, 0.17, 8), { y: -0.13, z: -0.36, sy: 0.55, sz: 0.4 }),
    ...hair(scene, look.hairStyle ?? 'short', look.hair),
  ];
  if (look.glasses) {
    face.push(
      place(ring(scene, PALETTE.glasses, 0.2, 0.03, 14), { x: -0.15, y: 0.06, z: -0.38, rx: Math.PI / 2 }),
      place(ring(scene, PALETTE.glasses, 0.2, 0.03, 14), { x: 0.15, y: 0.06, z: -0.38, rx: Math.PI / 2 }),
    );
  }
  const headMesh = merge(`dinerFace-${look.id}`, face);
  headMesh.parent = head;
  // Tip the face up a little towards the camera.
  head.rotation.x = 0.35;
  return { node, head };
}
