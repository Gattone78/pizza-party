import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { ball, block, merge, place, puck, ring } from './build';
import { PALETTE } from './palette';

/**
 * Topping pieces, each recognisable by silhouette alone and oversized for a
 * real pizza (A1). `size` is the piece's radius. Every model is one merged,
 * vertex-coloured mesh with its base on y = 0, ready to be instanced.
 */
export type ToppingModel = 'tomato' | 'pepperoni' | 'mushroom' | 'olive' | 'pepper' | 'pineapple' | 'disc';

const THICKNESS = 0.07;

type Builder = (scene: Scene, size: number, colors: readonly string[]) => Mesh[];

const around = (count: number, radius: number, each: (x: number, z: number, angle: number) => Mesh): Mesh[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return each(Math.cos(angle) * radius, Math.sin(angle) * radius, angle);
  });

const BUILDERS: Record<ToppingModel, Builder> = {
  // A slice with a paler heart and a wheel of seed pockets.
  tomato: (scene, size, [skin = PALETTE.tomato, flesh = PALETTE.tomatoFlesh, seed = PALETTE.tomatoSeed]) => [
    puck(scene, skin, { radius: size, height: THICKNESS }),
    place(puck(scene, flesh, { radius: size * 0.82, height: 0.01, tessellation: 20 }), { y: THICKNESS }),
    ...around(6, size * 0.5, (x, z, angle) =>
      place(puck(scene, seed, { radius: size * 0.2, height: 0.012, tessellation: 10 }), {
        x,
        z,
        y: THICKNESS + 0.008,
        ry: -angle,
        sz: 0.55,
      }),
    ),
    place(puck(scene, skin, { radius: size * 0.13, height: 0.014, tessellation: 10 }), { y: THICKNESS + 0.008 }),
  ],

  // A darker disc with pale spots of fat.
  pepperoni: (scene, size, [meat = PALETTE.pepperoni, spot = PALETTE.pepperoniSpot]) => [
    puck(scene, meat, { radius: size, height: THICKNESS }),
    ...around(5, size * 0.55, (x, z) =>
      place(puck(scene, spot, { radius: size * 0.14, height: 0.012, tessellation: 8 }), { x, z, y: THICKNESS }),
    ),
    place(puck(scene, spot, { radius: size * 0.12, height: 0.012, tessellation: 8 }), { y: THICKNESS }),
  ],

  // The classic cross-section: a domed cap over a stubby stem.
  mushroom: (scene, size, [cap = PALETTE.mushroomCap, stem = PALETTE.mushroomStem]) => [
    place(puck(scene, cap, { radius: size, height: THICKNESS, arc: 0.5 }), { z: size * 0.1, ry: Math.PI }),
    place(block(scene, stem, size * 0.62, THICKNESS * 0.9, size * 0.85), { y: THICKNESS * 0.45, z: -size * 0.3 }),
    place(puck(scene, stem, { radius: size * 0.31, height: THICKNESS * 0.9, tessellation: 12 }), { z: -size * 0.72 }),
  ],

  olive: (scene, size, [skin = PALETTE.olive]) => [
    place(ring(scene, skin, size * 1.5, size * 0.55), { y: size * 0.27 }),
  ],

  // Three lobes, like a ring cut across a bell pepper.
  pepper: (scene, size, [skin = PALETTE.pepper]) =>
    around(3, size * 0.36, (x, z) => place(ring(scene, skin, size * 1.15, size * 0.26, 16), { x, z, y: size * 0.13 })),

  // A chunky wedge with a pale core edge.
  pineapple: (scene, size, [flesh = PALETTE.pineapple, core = PALETTE.pineappleCore]) => [
    place(puck(scene, flesh, { radius: size * 1.5, height: THICKNESS * 1.6, arc: 0.2, tessellation: 40 }), {
      x: -size * 0.9,
      ry: Math.PI * 0.2,
    }),
    place(puck(scene, core, { radius: size * 0.5, height: THICKNESS * 1.7, arc: 0.2, tessellation: 40 }), {
      x: -size * 0.9,
      ry: Math.PI * 0.2,
    }),
  ],

  disc: (scene, size, [color = PALETTE.pepperoni]) => [puck(scene, color, { radius: size, height: THICKNESS })],
};

export function createToppingSource(
  scene: Scene,
  name: string,
  model: string,
  size: number,
  colors: readonly string[] = [],
): Mesh {
  const build = BUILDERS[model as ToppingModel] ?? BUILDERS.disc;
  return merge(name, build(scene, size, colors));
}

/** A pinch of shredded cheese, for carrying and for heaping in the cheese bowl. */
export function createCheeseShreds(scene: Scene, name: string, count: number, spread: number): Mesh {
  const shreds = Array.from({ length: count }, (_, i) => {
    const angle = i * 2.4;
    const distance = Math.sqrt((i + 0.5) / count) * spread;
    return place(block(scene, PALETTE.cheese[i % PALETTE.cheese.length] ?? PALETTE.cheese[0], 0.26, 0.05, 0.06), {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      y: 0.03 + (i % 3) * 0.035,
      ry: angle * 1.7,
      rz: ((i % 5) - 2) * 0.12,
    });
  });
  // A soft mound underneath so there are no gaps between shreds.
  shreds.push(place(ball(scene, PALETTE.cheese[0], spread * 1.9, 10), { sy: 0.3 }));
  return merge(name, shreds);
}
