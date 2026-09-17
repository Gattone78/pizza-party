import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { BOWL_RADIUS } from '../../core/counterLayout';
import { createBasedCylinder, flatMaterial } from './greybox';

/** Grey-box props. Primitive shapes only; real assets arrive in the art phase. */

export const BOWL_HEIGHT = 0.35;
export type PieceShape = 'disc' | 'ring' | 'box' | 'dome';

const unpickable = <T extends Mesh>(mesh: T): T => {
  mesh.isPickable = false;
  return mesh;
};

/** A neutral dish showing its contents' colour, as in the art reference. */
export function createBowl(scene: Scene, name: string, contents: StandardMaterial): Mesh {
  const bowl = createBasedCylinder(scene, `bowl-${name}`, {
    height: BOWL_HEIGHT,
    diameterTop: BOWL_RADIUS * 2,
    diameterBottom: BOWL_RADIUS * 1.4,
  });
  bowl.material = flatMaterial(scene, `bowlMat-${name}`, '#dfe3e8');
  const heap = unpickable(CreateSphere(`bowlHeap-${name}`, { diameter: BOWL_RADIUS * 1.7, segments: 12 }, scene));
  heap.scaling.y = 0.35;
  heap.material = contents;
  heap.parent = bowl;
  heap.position.y = BOWL_HEIGHT;
  return bowl;
}

/** The hidden mesh that topping pieces are instanced from. Its base sits at y = 0. */
export function createPieceSource(scene: Scene, name: string, shape: PieceShape, size: number): Mesh {
  let mesh: Mesh;
  switch (shape) {
    case 'ring':
      mesh = CreateTorus(name, { diameter: size * 2, thickness: size * 0.55, tessellation: 20 }, scene);
      mesh.position.y = size * 0.275;
      break;
    case 'box':
      mesh = CreateBox(name, { width: size * 1.7, depth: size * 1.3, height: size * 0.6 }, scene);
      mesh.position.y = size * 0.3;
      break;
    case 'dome':
      mesh = CreateSphere(name, { diameter: size * 2, segments: 10 }, scene);
      mesh.scaling.y = 0.55;
      mesh.position.y = size * 0.3;
      break;
    default:
      mesh = createBasedCylinder(scene, name, { height: 0.08, diameterTop: size * 2, tessellation: 20 });
  }
  mesh.bakeCurrentTransformIntoVertices();
  return unpickable(mesh);
}

export const BOTTLE_HEIGHT = 1.15;

/** Sauce squeeze bottle. `body` is separate so it can tip over the node's origin while carried. */
export function createBottle(scene: Scene): { node: TransformNode; body: TransformNode } {
  const node = new TransformNode('bottle', scene);
  const body = new TransformNode('bottleBody', scene);
  body.parent = node;
  const red = flatMaterial(scene, 'bottleMat', '#d8352a');
  const tube = createBasedCylinder(scene, 'bottleTube', { height: 0.8, diameterTop: 0.55 });
  tube.material = red;
  tube.parent = body;
  const nozzle = createBasedCylinder(scene, 'bottleNozzle', {
    height: BOTTLE_HEIGHT - 0.8,
    diameterTop: 0.08,
    diameterBottom: 0.45,
  });
  nozzle.material = red;
  nozzle.parent = body;
  nozzle.position.y = 0.8;
  return { node, body };
}

/** The big "done" object (G1.6): a chunky bell. Its material is animated to glow. */
export function createBell(scene: Scene): { node: TransformNode; material: StandardMaterial } {
  const node = new TransformNode('bell', scene);
  const material = flatMaterial(scene, 'bellMat', '#f2a71b', true);
  const dome = unpickable(CreateSphere('bellDome', { diameter: BOWL_RADIUS * 2, segments: 16 }, scene));
  dome.scaling.y = 0.75;
  dome.position.y = 0.2;
  dome.material = material;
  dome.parent = node;
  const base = createBasedCylinder(scene, 'bellBase', { height: 0.12, diameterTop: BOWL_RADIUS * 2.2 });
  base.material = flatMaterial(scene, 'bellBaseMat', '#8a5a2b');
  base.parent = node;
  const knob = unpickable(CreateSphere('bellKnob', { diameter: 0.3, segments: 10 }, scene));
  knob.position.y = 0.66;
  knob.material = material;
  knob.parent = node;
  return { node, material };
}

export interface OvenProp {
  readonly node: TransformNode;
  readonly door: Mesh;
  readonly glass: StandardMaterial;
}

/**
 * An oven whose mouth faces -x. The top is glass so the pizza can be watched
 * from the fixed camera while it bakes (G2.3). `size` is the inner square.
 */
export function createOven(scene: Scene, size: number, height: number): OvenProp {
  const node = new TransformNode('oven', scene);
  const steel = flatMaterial(scene, 'ovenMat', '#59616b');
  const wall = 0.2;
  const half = size / 2;
  const addWall = (name: string, w: number, d: number, x: number, z: number): void => {
    const box = unpickable(CreateBox(name, { width: w, depth: d, height }, scene));
    box.position.set(x, height / 2, z);
    box.material = steel;
    box.parent = node;
  };
  addWall('ovenBack', wall, size + wall * 2, half + wall / 2, 0);
  addWall('ovenFar', size, wall, 0, half + wall / 2);
  addWall('ovenNear', size, wall, 0, -half - wall / 2);

  const glass = flatMaterial(scene, 'ovenGlassMat', '#ff9d3c', true);
  glass.alpha = 0.35;
  glass.emissiveColor = new Color3(0.25, 0.1, 0);
  const top = unpickable(CreateBox('ovenTop', { width: size + wall, depth: size + wall * 2, height: 0.08 }, scene));
  top.position.set(wall / 2, height, 0);
  top.material = glass;
  top.parent = node;

  const door = unpickable(CreateBox('ovenDoor', { width: wall, depth: size, height }, scene));
  door.position.set(-half - wall / 2, height / 2, 0);
  door.material = steel;
  door.parent = node;
  return { node, door, glass };
}

/** Chunky, rounded, toy-like pizza wheel with nothing sharp about it (G3.5). */
export function createWheel(scene: Scene): TransformNode {
  const node = new TransformNode('wheel', scene);
  const blade = unpickable(CreateTorus('wheelBlade', { diameter: 0.8, thickness: 0.18, tessellation: 24 }, scene));
  blade.rotation.x = Math.PI / 2;
  blade.position.y = 0.5;
  blade.material = flatMaterial(scene, 'wheelBladeMat', '#c9d1d9');
  blade.parent = node;
  const hub = unpickable(CreateSphere('wheelHub', { diameter: 0.5, segments: 10 }, scene));
  hub.position.y = 0.5;
  hub.material = flatMaterial(scene, 'wheelHubMat', '#2f80ed');
  hub.parent = node;
  const handle = createBasedCylinder(scene, 'wheelHandle', { height: 0.9, diameterTop: 0.3 });
  handle.position.y = 0.6;
  handle.rotation.x = -0.9;
  handle.material = hub.material;
  handle.parent = node;
  return node;
}

export const PLATE_HEIGHT = 0.08;

export function createPlate(scene: Scene, name: string, radius: number): TransformNode {
  const node = new TransformNode(name, scene);
  const dish = createBasedCylinder(scene, `${name}-dish`, {
    height: PLATE_HEIGHT,
    diameterTop: radius * 2,
    diameterBottom: radius * 1.5,
  });
  dish.material = flatMaterial(scene, `${name}-mat`, '#ffffff');
  dish.parent = node;
  return node;
}

export interface DinerLook {
  readonly id: string;
  readonly body: string;
  readonly skin: string;
  readonly hair: string;
}

/** A family member told apart by body, skin and hair colour (A4). */
export function createDiner(scene: Scene, look: DinerLook): TransformNode {
  const node = new TransformNode(`diner-${look.id}`, scene);
  const body = createBasedCylinder(scene, `dinerBody-${look.id}`, {
    height: 0.75,
    diameterTop: 0.7,
    diameterBottom: 1,
  });
  body.material = flatMaterial(scene, `dinerBodyMat-${look.id}`, look.body);
  body.parent = node;
  const head = unpickable(CreateSphere(`dinerHead-${look.id}`, { diameter: 0.75, segments: 12 }, scene));
  head.position.y = 1.05;
  head.material = flatMaterial(scene, `dinerSkinMat-${look.id}`, look.skin);
  head.parent = node;
  const hair = unpickable(CreateSphere(`dinerHair-${look.id}`, { diameter: 0.8, segments: 12 }, scene));
  hair.scaling.y = 0.55;
  hair.position.set(0, 1.27, 0.06);
  hair.material = flatMaterial(scene, `dinerHairMat-${look.id}`, look.hair);
  hair.parent = node;
  return node;
}
