import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLathe } from '@babylonjs/core/Meshes/Builders/latheBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Helpers for code-built art. Everything is coloured per vertex from the
 * palette and drawn with one shared matte material, so mixed shapes read as
 * one toy set and merged props cost a single draw call.
 */

export function toyMaterial(scene: Scene, name = 'toyMat'): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  // Lathed and merged shapes are seen from both sides (bowl insides, thin rims).
  material.backFaceCulling = false;
  // Light whichever side faces the camera, so the winding of a lathed profile never matters.
  material.twoSidedLighting = true;
  return material;
}

/** Colour every vertex of `mesh` and give it the shared toy material. */
export function paint<T extends Mesh>(mesh: T, hex: string): T {
  const color = Color3.FromHexString(hex.toLowerCase());
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  mesh.material = toyMaterial(mesh.getScene());
  mesh.isPickable = false;
  return mesh;
}

/** Bake the parts' transforms and colours into one mesh. The parts are disposed. */
export function merge(name: string, parts: Mesh[]): Mesh {
  const scene = parts[0]!.getScene();
  parts.forEach((part) => part.computeWorldMatrix(true));
  const merged = Mesh.MergeMeshes(parts, true, true) ?? new Mesh(name, scene);
  merged.name = name;
  merged.material = toyMaterial(scene);
  merged.isPickable = false;
  return merged;
}

/** Cylinder or cone standing on y = 0. */
export function puck(
  scene: Scene,
  hex: string,
  o: { radius: number; height: number; topRadius?: number; tessellation?: number; arc?: number },
): Mesh {
  const mesh = CreateCylinder(
    'puck',
    {
      height: o.height,
      diameterBottom: o.radius * 2,
      diameterTop: (o.topRadius ?? o.radius) * 2,
      tessellation: o.tessellation ?? 24,
      arc: o.arc ?? 1,
      enclose: o.arc !== undefined,
    },
    scene,
  );
  mesh.bakeTransformIntoVertices(Matrix.Translation(0, o.height / 2, 0));
  return paint(mesh, hex);
}

export function ball(scene: Scene, hex: string, diameter: number, segments = 12): Mesh {
  return paint(CreateSphere('ball', { diameter, segments }, scene), hex);
}

export function block(scene: Scene, hex: string, width: number, height: number, depth: number): Mesh {
  return paint(CreateBox('block', { width, height, depth }, scene), hex);
}

export function ring(scene: Scene, hex: string, diameter: number, thickness: number, tessellation = 20): Mesh {
  return paint(CreateTorus('ring', { diameter, thickness, tessellation }, scene), hex);
}

/** Surface of revolution from a profile of [radius, height] points, bottom to top. */
export function lathe(scene: Scene, hex: string, profile: readonly (readonly [number, number])[], tessellation = 28): Mesh {
  const mesh = CreateLathe(
    'lathe',
    { shape: profile.map(([r, y]) => new Vector3(r, y, 0)), tessellation, closed: true },
    scene,
  );
  return paint(mesh, hex);
}

/** Position, rotate and scale a part before it is merged. */
export function place<T extends Mesh>(
  mesh: T,
  o: { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number },
): T {
  mesh.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  mesh.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  mesh.scaling.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  return mesh;
}

const SHADOW_SOURCE = 'blobShadowSource';

/**
 * A soft round drop shadow, as under everything in the art reference. Cheap:
 * instances of one textured quad, no shadow maps. Radius 1 at scale 1.
 */
export function blobShadow(scene: Scene, radius: number): InstancedMesh {
  let source = scene.getMeshByName(SHADOW_SOURCE) as Mesh | null;
  if (!source) {
    const size = 64;
    const texture = new DynamicTexture('blobShadowTex', size, scene, true);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(40, 20, 60, 0.42)');
    gradient.addColorStop(0.7, 'rgba(40, 20, 60, 0.25)');
    gradient.addColorStop(1, 'rgba(40, 20, 60, 0)');
    context.clearRect(0, 0, size, size);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    texture.hasAlpha = true;
    texture.update();

    const material = new StandardMaterial('blobShadowMat', scene);
    material.diffuseTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    material.specularColor = Color3.Black();

    source = CreateGround(SHADOW_SOURCE, { width: 2, height: 2 }, scene);
    source.material = material;
    source.isPickable = false;
    source.isVisible = false;
  }
  const shadow = source.createInstance('blobShadow');
  shadow.isPickable = false;
  shadow.scaling.set(radius, 1, radius);
  shadow.position.y = 0.015;
  return shadow;
}
