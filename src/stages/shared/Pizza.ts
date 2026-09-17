import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { PIZZA_CENTER, PIZZA_RADIUS } from '../../core/counterLayout';
import { vec3, type Vec3 } from '../../core/vec';
import { sliceCount, sliceIndexForPoint, sliceSpan, type Point2 } from '../../interact/CutTracker';
import type { DropZone } from '../../interact/DropZone';
import { blobShadow, merge, place, puck } from '../../art/build';
import { PALETTE } from '../../art/palette';
import { NodeView, createSector, flatMaterial } from './greybox';

const CRUST_HEIGHT = 0.1;
const TOP_HEIGHT = 0.02;
const R = PIZZA_RADIUS;
/** Dough base with a puffy rounded rim. */
const CRUST_PROFILE = [
  [0, CRUST_HEIGHT],
  [R - 0.3, CRUST_HEIGHT],
  [R - 0.25, 0.16],
  [R - 0.15, 0.2],
  [R - 0.06, 0.17],
  [R, 0.09],
  [R, 0],
] as const;
const PLATTER_RADIUS = R + 0.17;
/** The sauce-able area inside the crust ring. Also the extent of the mask texture. */
export const PIZZA_TOP_RADIUS = PIZZA_RADIUS - 0.25;
const TOP_PROFILE = [
  [0, TOP_HEIGHT],
  [PIZZA_TOP_RADIUS, TOP_HEIGHT],
  [PIZZA_TOP_RADIUS, 0],
] as const;
export const SAUCE_BRUSH = 0.4;
export const CHEESE_BRUSH = 0.45;

const TEXTURE_SIZE = 512;
const DOUGH = PALETTE.dough;
const SAUCE = PALETTE.sauce;
const CHEESE = PALETTE.cheese;
const CRUST_RAW = Color3.FromHexString(PALETTE.crust);
const CRUST_BAKED = Color3.FromHexString(PALETTE.crustBaked);
/** Browned patches that appear on the cheese as it bakes. */
const BAKE_SPOTS = 22;
const TOP_RAW = Color3.White();
const TOP_BAKED = new Color3(0.9, 0.78, 0.62);

export interface PizzaSlice {
  readonly index: number;
  readonly node: TransformNode;
  readonly view: NodeView;
  /** Pizza-local position of the slice when the pizza is whole. */
  readonly rest: Point2;
}

/**
 * The pizza that travels through every stage. Sauce and cheese are painted
 * into one mask texture rather than spawned as objects (G0.8); toppings are
 * parented to it, and later to its slices, so they move with it.
 */
export class Pizza {
  readonly root: TransformNode;
  readonly view: NodeView;
  /** Drop zone for toppings while the pizza is at its home position. */
  readonly zone: DropZone = {
    id: 'pizza',
    center: PIZZA_CENTER,
    // Forgiving (P3): a release a little outside the crust still counts and is pulled in.
    acceptRadius: PIZZA_RADIUS + 0.45,
    landRadius: PIZZA_RADIUS - 0.5,
    surfaceY: CRUST_HEIGHT + TOP_HEIGHT,
  };
  slices: PizzaSlice[] | null = null;

  private readonly crust: Mesh;
  private readonly platter: Mesh;
  private readonly shadow: InstancedMesh;
  private bakeSpots = 0;
  private readonly top: Mesh;
  private readonly crustMaterial: StandardMaterial;
  private readonly topMaterial: StandardMaterial;
  private readonly texture: DynamicTexture;
  private readonly context: CanvasRenderingContext2D;
  private toppings: TransformNode[] = [];
  private keptAlive: { dispose(): void }[] = [];
  private dirty = true;

  constructor(private readonly scene: Scene) {
    this.root = new TransformNode('pizza', scene);
    this.view = new NodeView(this.root, 1, false);

    // A round wooden platter travels with the pizza, into the oven and back.
    this.platter = merge('pizzaPlatter', [
      puck(scene, PALETTE.woodDark, { radius: PLATTER_RADIUS, height: 0.04, tessellation: 48 }),
      place(puck(scene, PALETTE.wood, { radius: PLATTER_RADIUS - 0.08, height: 0.01, tessellation: 48 }), { y: 0.04 }),
    ]);
    this.platter.parent = this.root;
    this.shadow = blobShadow(scene, PLATTER_RADIUS * 1.18);
    this.shadow.parent = this.root;

    this.crustMaterial = flatMaterial(scene, 'crustMat', PALETTE.crust, true);
    this.crustMaterial.backFaceCulling = false;

    this.texture = new DynamicTexture('pizzaMask', TEXTURE_SIZE, scene, true);
    this.context = this.texture.getContext() as unknown as CanvasRenderingContext2D;
    this.topMaterial = new StandardMaterial('pizzaTopMat', scene);
    this.topMaterial.diffuseTexture = this.texture;
    this.topMaterial.specularColor = Color3.Black();
    this.topMaterial.backFaceCulling = false;

    const whole = { from: 0, to: Math.PI * 2, origin: { x: 0, z: 0 }, uvRadius: PIZZA_TOP_RADIUS };
    this.crust = createSector(scene, 'pizzaCrust', { ...whole, profile: CRUST_PROFILE });
    this.crust.material = this.crustMaterial;
    this.crust.parent = this.root;
    this.top = createSector(scene, 'pizzaTop', { ...whole, profile: TOP_PROFILE });
    this.top.material = this.topMaterial;
    this.top.parent = this.root;
    this.top.position.y = CRUST_HEIGHT;

    this.reset();
  }

  /** World position to pizza-local counter coordinates. */
  toLocal(world: Vec3): Point2 {
    return { x: world.x - this.root.position.x, z: world.z - this.root.position.z };
  }

  /** A fresh ball of plain dough at the home position (G6.2). */
  reset(): void {
    this.slices?.forEach((slice) => slice.node.dispose());
    this.slices = null;
    this.toppings.forEach((node) => node.dispose());
    this.toppings = [];
    this.keptAlive.forEach((item) => item.dispose());
    this.keptAlive = [];
    this.crust.setEnabled(true);
    this.top.setEnabled(true);
    this.setPlatterVisible(true);
    this.bakeSpots = 0;
    this.root.position.set(PIZZA_CENTER.x, PIZZA_CENTER.y, PIZZA_CENTER.z);
    this.setBaked(0);

    this.context.fillStyle = DOUGH;
    this.context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    this.dirty = true;
  }

  paintSauce(p: Point2): void {
    this.context.fillStyle = SAUCE;
    this.disc(p, SAUCE_BRUSH);
  }

  /** Sauce spreading out from the middle to cover the rest (G0.2). `t` runs 0..1. */
  fillSauce(t: number): void {
    this.context.fillStyle = SAUCE;
    this.disc({ x: 0, z: 0 }, PIZZA_TOP_RADIUS * 1.05 * t);
  }

  paintCheese(p: Point2): void {
    this.sprinkle(p, CHEESE_BRUSH, 14);
  }

  /** A shower of cheese over the whole pizza (G0.5). Call every frame of the fill. */
  fillCheese(): void {
    this.sprinkle({ x: 0, z: 0 }, PIZZA_TOP_RADIUS, 60);
  }

  /** Upload the mask if it changed. Call once per frame, not per paint. */
  flush(): void {
    if (!this.dirty) return;
    this.texture.update();
    this.dirty = false;
  }

  /** Make a landed topping part of the pizza. */
  addTopping(node: TransformNode): void {
    node.setParent(this.root);
    this.toppings.push(node);
  }

  /** Keep something (e.g. the source mesh of topping instances) until the pizza is reset. */
  keepAlive(item: { dispose(): void }): void {
    this.keptAlive.push(item);
  }

  /** Raw to baked look, 0..1 (A3): the crust and cheese darken and brown patches appear. */
  setBaked(t: number): void {
    Color3.LerpToRef(CRUST_RAW, CRUST_BAKED, t, this.crustMaterial.diffuseColor);
    Color3.LerpToRef(TOP_RAW, TOP_BAKED, t, this.topMaterial.diffuseColor);
    // The cheese bubbles and browns in patches as the bake goes on (G2.3).
    const wanted = Math.floor(t * BAKE_SPOTS);
    for (; this.bakeSpots < wanted; this.bakeSpots++) {
      const distance = Math.sqrt(Math.random()) * PIZZA_TOP_RADIUS * 0.95;
      const angle = Math.random() * Math.PI * 2;
      this.context.fillStyle = `rgba(150, 78, 20, ${0.16 + Math.random() * 0.14})`;
      this.disc({ x: Math.cos(angle) * distance, z: Math.sin(angle) * distance }, 0.06 + Math.random() * 0.1);
    }
  }

  /** The empty platter is cleared away once the slices have all left it. */
  setPlatterVisible(visible: boolean): void {
    this.platter.setEnabled(visible);
    this.shadow.setEnabled(visible);
  }

  /** Swap the whole pizza for slices that look identical until they are moved apart. */
  slice(cuts: number): PizzaSlice[] {
    if (this.slices) return this.slices;
    const step = Math.PI / cuts;
    const centroidDistance = (2 * PIZZA_RADIUS * Math.sin(step / 2)) / (3 * (step / 2));

    this.slices = Array.from({ length: sliceCount(cuts) }, (_, index) => {
      const { from, to } = sliceSpan(index, cuts);
      const mid = (from + to) / 2;
      const rest = { x: Math.cos(mid) * centroidDistance, z: Math.sin(mid) * centroidDistance };
      const node = new TransformNode(`slice-${index}`, this.scene);
      node.parent = this.root;
      node.position.set(rest.x, 0, rest.z);

      const shape = { from, to, origin: rest, uvRadius: PIZZA_TOP_RADIUS };
      const crust = createSector(this.scene, `sliceCrust-${index}`, { ...shape, profile: CRUST_PROFILE });
      crust.material = this.crustMaterial;
      crust.parent = node;
      const top = createSector(this.scene, `sliceTop-${index}`, { ...shape, profile: TOP_PROFILE });
      top.material = this.topMaterial;
      top.parent = node;
      top.position.y = CRUST_HEIGHT;

      return { index, node, view: new NodeView(node, 1, false), rest };
    });

    for (const topping of this.toppings) {
      const local = { x: topping.position.x, z: topping.position.z };
      const slice = this.slices[sliceIndexForPoint(local, cuts)];
      if (slice) topping.setParent(slice.node);
    }
    this.crust.setEnabled(false);
    this.top.setEnabled(false);
    return this.slices;
  }

  /** World-space home of the pizza, for stages that move it. */
  get home(): Vec3 {
    return vec3(PIZZA_CENTER.x, PIZZA_CENTER.y, PIZZA_CENTER.z);
  }

  private toCanvas(p: Point2): { x: number; y: number } {
    return {
      x: (p.x / (PIZZA_TOP_RADIUS * 2) + 0.5) * TEXTURE_SIZE,
      y: (1 - (p.z / (PIZZA_TOP_RADIUS * 2) + 0.5)) * TEXTURE_SIZE,
    };
  }

  private toPixels(length: number): number {
    return (length / (PIZZA_TOP_RADIUS * 2)) * TEXTURE_SIZE;
  }

  private disc(p: Point2, radius: number): void {
    const c = this.toCanvas(p);
    this.context.beginPath();
    this.context.arc(c.x, c.y, this.toPixels(radius), 0, Math.PI * 2);
    this.context.fill();
    this.dirty = true;
  }

  private sprinkle(p: Point2, radius: number, count: number): void {
    const c = this.toCanvas(p);
    const r = this.toPixels(radius);
    this.context.lineWidth = 6;
    this.context.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const distance = Math.sqrt(Math.random()) * r;
      const around = Math.random() * Math.PI * 2;
      const x = c.x + Math.cos(around) * distance;
      const y = c.y + Math.sin(around) * distance;
      const angle = Math.random() * Math.PI;
      this.context.strokeStyle = CHEESE[i % CHEESE.length] ?? '#f7d774';
      this.context.beginPath();
      this.context.moveTo(x - Math.cos(angle) * 11, y - Math.sin(angle) * 11);
      this.context.lineTo(x + Math.cos(angle) * 11, y + Math.sin(angle) * 11);
      this.context.stroke();
    }
    this.dirty = true;
  }
}
