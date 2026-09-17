import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Flat, matte, frozen material for grey-box shapes. */
export function flatMaterial(scene: Scene, name: string, hex: string): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.specularColor = Color3.Black();
  material.freeze();
  return material;
}

/** A cylinder whose origin is the centre of its base, so it sits on a surface at its y. */
export function createBasedCylinder(
  scene: Scene,
  name: string,
  options: { height: number; diameterTop: number; diameterBottom?: number; tessellation?: number },
): Mesh {
  const mesh = CreateCylinder(
    name,
    {
      height: options.height,
      diameterTop: options.diameterTop,
      diameterBottom: options.diameterBottom ?? options.diameterTop,
      tessellation: options.tessellation ?? 32,
    },
    scene,
  );
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, options.height / 2, 0));
  mesh.isPickable = false;
  return mesh;
}
