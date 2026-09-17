import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { BOWL_RADIUS } from '../core/counterLayout';
import { ball, blobShadow, block, lathe, merge, place, puck, ring, toyMaterial } from './build';
import { PALETTE } from './palette';

/** Chunky wooden-toy props, built in code from the shared palette. */

export const BOWL_HEIGHT = 0.35;
export const BOTTLE_HEIGHT = 1.15;
export const PLATE_HEIGHT = 0.05;

/** A plain white dish: the topping inside supplies the colour, as in the art reference. */
export function createBowlSource(scene: Scene): Mesh {
  const r = BOWL_RADIUS;
  const bowl = lathe(scene, PALETTE.dish, [
    [0, 0],
    [r * 0.62, 0],
    [r * 0.96, BOWL_HEIGHT * 0.8],
    [r, BOWL_HEIGHT],
    [r * 0.9, BOWL_HEIGHT],
    [r * 0.6, 0.09],
    [0, 0.09],
  ]);
  bowl.name = 'bowlSource';
  return bowl;
}

/**
 * A bowl heaped full of its topping: a mound in the topping's colour with a
 * handful of pieces lying on it. The pieces are instances of `piece`, so a
 * full bowl costs no extra draw calls.
 */
export function createHeapedBowl(
  scene: Scene,
  name: string,
  bowlSource: Mesh,
  piece: Mesh,
  moundColor: string,
  pieceSize: number,
): { node: TransformNode; mound: Mesh } {
  const node = new TransformNode(`bowl-${name}`, scene);
  const bowl = bowlSource.createInstance(`bowlDish-${name}`);
  bowl.isPickable = false;
  bowl.parent = node;
  blobShadow(scene, BOWL_RADIUS * 1.25).parent = node;

  const mound = place(ball(scene, moundColor, BOWL_RADIUS * 1.72, 12), { y: BOWL_HEIGHT * 0.78, sy: 0.32 });
  mound.name = `bowlMound-${name}`;
  mound.parent = node;

  const count = 7;
  for (let i = 0; i < count; i++) {
    const heap: InstancedMesh = piece.createInstance(`bowlHeap-${name}-${i}`);
    heap.isPickable = false;
    heap.parent = node;
    const angle = i * 2.4;
    const distance = i === 0 ? 0 : Math.min(BOWL_RADIUS * 0.62 - pieceSize * 0.4, BOWL_RADIUS * 0.5);
    heap.position.set(
      Math.cos(angle) * distance,
      BOWL_HEIGHT * 0.88 + (i === 0 ? 0.07 : 0) + (i % 2) * 0.02,
      Math.sin(angle) * distance,
    );
    heap.rotation.set(((i % 3) - 1) * 0.18, angle * 1.3, ((i % 2) - 0.5) * 0.3);
    heap.scaling.setAll(0.8);
  }
  return { node, mound };
}

/** Sauce squeeze bottle. `body` is separate so it can tip over the node's origin while carried. */
export function createBottle(scene: Scene): { node: TransformNode; body: TransformNode } {
  const node = new TransformNode('bottle', scene);
  const body = new TransformNode('bottleBody', scene);
  body.parent = node;
  blobShadow(scene, 0.45).parent = node;

  const mesh = merge('bottleMesh', [
    lathe(scene, PALETTE.bottle, [
      [0, 0],
      [0.26, 0],
      [0.3, 0.06],
      [0.3, 0.6],
      [0.24, 0.74],
      [0.13, 0.82],
      [0.13, 0.88],
      [0.09, 0.9],
      [0.03, BOTTLE_HEIGHT],
      [0, BOTTLE_HEIGHT],
    ]),
    place(puck(scene, PALETTE.label, { radius: 0.305, height: 0.26 }), { y: 0.22 }),
    place(puck(scene, PALETTE.tomato, { radius: 0.12, height: 0.27, tessellation: 12 }), { y: 0.215, z: -0.2 }),
  ]);
  mesh.parent = body;
  return { node, body };
}

/** The big "done" object (G1.6): a chunky brass bell. Its own material lets it glow. */
export function createBell(scene: Scene): { node: TransformNode; material: StandardMaterial } {
  const node = new TransformNode('bell', scene);
  const r = BOWL_RADIUS;
  blobShadow(scene, r * 1.45).parent = node;

  const base = puck(scene, PALETTE.bellBase, { radius: r * 1.15, height: 0.12, topRadius: r * 1.05 });
  base.parent = node;

  const material = toyMaterial(scene, 'bellMat');
  const dome = merge('bellDome', [
    lathe(scene, PALETTE.bell, [
      [r * 0.98, 0.1],
      [r * 0.9, 0.2],
      [r * 0.8, 0.42],
      [r * 0.55, 0.62],
      [r * 0.2, 0.72],
      [0, 0.73],
    ]),
    place(ball(scene, PALETTE.bottle, 0.3, 10), { y: 0.8 }),
  ]);
  dome.material = material;
  dome.parent = node;
  return { node, material };
}

export interface OvenProp {
  readonly node: TransformNode;
  readonly door: Mesh;
  readonly glass: StandardMaterial;
}

/**
 * A toy oven whose mouth faces -x. The top is glass so the pizza can be
 * watched from the fixed camera while it bakes (G2.3). `size` is the inner square.
 */
export function createOven(scene: Scene, size: number, height: number): OvenProp {
  const node = new TransformNode('oven', scene);
  const wall = 0.28;
  const half = size / 2;
  blobShadow(scene, half * 1.7).parent = node;

  const body = merge('ovenBody', [
    place(block(scene, PALETTE.oven, wall, height, size + wall * 2), { x: half + wall / 2, y: height / 2 }),
    place(block(scene, PALETTE.oven, size, height, wall), { y: height / 2, z: half + wall / 2 }),
    place(block(scene, PALETTE.oven, size, height, wall), { y: height / 2, z: -half - wall / 2 }),
    place(block(scene, PALETTE.ovenInside, size, 0.04, size), { y: 0.02 }),
    // A frame around the glass, and two chunky knobs on the near side.
    place(block(scene, PALETTE.ovenTrim, size + wall * 2, 0.1, wall), { x: wall / 2, y: height + 0.05, z: half + wall / 2 }),
    place(block(scene, PALETTE.ovenTrim, size + wall * 2, 0.1, wall), { x: wall / 2, y: height + 0.05, z: -half - wall / 2 }),
    place(block(scene, PALETTE.ovenTrim, wall, 0.1, size), { x: half + wall / 2, y: height + 0.05 }),
    place(block(scene, PALETTE.ovenTrim, wall, 0.1, size), { x: -half + wall / 2, y: height + 0.05 }),
    place(ball(scene, PALETTE.bell, 0.3, 10), { x: -half * 0.4, y: height * 0.55, z: -half - wall }),
    place(ball(scene, PALETTE.bell, 0.3, 10), { x: half * 0.4, y: height * 0.55, z: -half - wall }),
  ]);
  body.parent = node;

  const glass = toyMaterial(scene, 'ovenGlassMat');
  glass.alpha = 0.32;
  glass.emissiveColor.set(0.25, 0.1, 0);
  const top = block(scene, PALETTE.ovenGlass, size, 0.06, size);
  top.position.set(0, height, 0);
  top.material = glass;
  top.parent = node;

  const door = merge('ovenDoor', [
    place(block(scene, PALETTE.ovenTrim, wall * 0.7, height, size), { y: 0 }),
    place(block(scene, PALETTE.steel, 0.12, 0.12, size * 0.5), { x: -wall * 0.5, y: height * 0.2 }),
  ]);
  door.position.set(-half - wall * 0.35, height / 2, 0);
  door.parent = node;
  return { node, door, glass };
}

/** Chunky, rounded, toy-like pizza wheel with nothing sharp about it (G3.5). */
export function createWheel(scene: Scene): TransformNode {
  const node = new TransformNode('wheel', scene);
  blobShadow(scene, 0.55).parent = node;
  const mesh = merge('wheelMesh', [
    place(ring(scene, PALETTE.steel, 0.8, 0.18, 24), { y: 0.5, rx: Math.PI / 2 }),
    place(puck(scene, PALETTE.steel, { radius: 0.34, height: 0.08 }), { y: 0.5, z: -0.04, rx: Math.PI / 2 }),
    place(ball(scene, PALETTE.handle, 0.42, 10), { y: 0.5 }),
    place(puck(scene, PALETTE.handle, { radius: 0.15, height: 0.85, tessellation: 12 }), { y: 0.6, rx: -0.9 }),
    place(ball(scene, PALETTE.handle, 0.34, 10), { y: 1.13, z: -0.67 }),
  ]);
  mesh.parent = node;
  return node;
}

export function createPlate(scene: Scene, name: string, radius: number, rimColor: string): TransformNode {
  const node = new TransformNode(name, scene);
  blobShadow(scene, radius * 1.2).parent = node;
  const dish = merge(`${name}-dish`, [
    lathe(scene, PALETTE.dish, [
      [0, 0],
      [radius * 0.7, 0],
      [radius, 0.09],
      [radius * 0.93, 0.11],
      [radius * 0.68, PLATE_HEIGHT],
      [0, PLATE_HEIGHT],
    ]),
    place(ring(scene, rimColor, radius * 1.93, 0.05, 32), { y: 0.105 }),
  ]);
  dish.parent = node;
  return node;
}
