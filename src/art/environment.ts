import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE } from './palette';

const CLOTH_WIDTH = 30;
const CLOTH_DEPTH = 24;
const CHECK = 1.5;
const TEXTURE_SIZE = 1024;

/** Deterministic scatter, so the tablecloth looks the same every launch. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Soft, even toy-shop lighting and a checkered tablecloth. The kitchen mess
 * from the art reference (flour dust, sauce splats, stray basil) is painted
 * straight into the cloth, so it costs nothing to draw and never gets in the
 * way of anything interactive.
 */
export function createEnvironment(scene: Scene): void {
  scene.clearColor = Color4.FromHexString(`${PALETTE.clothDark}ff`);

  const sky = new HemisphericLight('skyLight', new Vector3(0.1, 1, -0.3), scene);
  sky.intensity = 0.95;
  sky.groundColor = new Color3(0.55, 0.5, 0.6);
  const sun = new DirectionalLight('sunLight', new Vector3(-0.4, -1, 0.5), scene);
  sun.intensity = 0.3;

  const texture = new DynamicTexture('clothTex', TEXTURE_SIZE, scene, true);
  const c = texture.getContext() as unknown as CanvasRenderingContext2D;
  const px = (units: number, across: number): number => (units / across) * TEXTURE_SIZE;
  const cellW = px(CHECK, CLOTH_WIDTH);
  const cellH = px(CHECK, CLOTH_DEPTH);
  for (let j = 0; j * cellH < TEXTURE_SIZE; j++) {
    for (let i = 0; i * cellW < TEXTURE_SIZE; i++) {
      c.fillStyle = (i + j) % 2 === 0 ? PALETTE.clothLight : PALETTE.clothDark;
      c.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
    }
  }

  // Decoration stays in a ring around the play area's middle, clear of the pizza.
  const random = seeded(7);
  const spot = (): { x: number; y: number } => {
    const angle = random() * Math.PI * 2;
    const distance = 2.6 + random() * 3.2;
    return {
      x: TEXTURE_SIZE / 2 + px(Math.cos(angle) * distance * 1.25, CLOTH_WIDTH),
      y: TEXTURE_SIZE / 2 + px(Math.sin(angle) * distance * 0.8, CLOTH_DEPTH),
    };
  };
  const blob = (x: number, y: number, rx: number, ry: number): void => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2);
    c.fill();
  };

  // Flour dust: clouds of fine white dots.
  for (let cloud = 0; cloud < 9; cloud++) {
    const at = spot();
    for (let i = 0; i < 90; i++) {
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * px(1.1, CLOTH_WIDTH);
      c.fillStyle = `rgba(255, 255, 255, ${0.25 + random() * 0.45})`;
      blob(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d * 0.8, 1 + random() * 1.6, 1 + random() * 1.6);
    }
  }
  // Sauce splats.
  for (let splat = 0; splat < 5; splat++) {
    const at = spot();
    c.fillStyle = PALETTE.sauce;
    blob(at.x, at.y, 9, 7);
    for (let i = 0; i < 4; i++) blob(at.x + (random() - 0.5) * 34, at.y + (random() - 0.5) * 30, 3.5, 3);
  }
  // Basil leaves, in pairs.
  for (let leaf = 0; leaf < 5; leaf++) {
    const at = spot();
    c.fillStyle = '#3f9b47';
    blob(at.x, at.y, 9, 5);
    c.fillStyle = '#57b85c';
    blob(at.x + 9, at.y + 6, 7, 4);
  }
  // Stray cheese shreds.
  c.lineCap = 'round';
  c.lineWidth = 2.5;
  for (let shred = 0; shred < 12; shred++) {
    const at = spot();
    const a = random() * Math.PI;
    c.strokeStyle = PALETTE.cheese[shred % PALETTE.cheese.length] ?? PALETTE.cheese[0];
    c.beginPath();
    c.moveTo(at.x - Math.cos(a) * 5, at.y - Math.sin(a) * 5);
    c.lineTo(at.x + Math.cos(a) * 5, at.y + Math.sin(a) * 5);
    c.stroke();
  }
  texture.update();

  const material = new StandardMaterial('clothMat', scene);
  material.diffuseTexture = texture;
  material.specularColor = Color3.Black();
  material.freeze();

  const cloth = CreateGround('cloth', { width: CLOTH_WIDTH, height: CLOTH_DEPTH }, scene);
  cloth.material = material;
  cloth.isPickable = false;
  cloth.freezeWorldMatrix();
}
