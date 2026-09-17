import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Vec3 } from '../../core/vec';
import type { PieceView } from '../../interact/DragController';

/**
 * Flat matte material for grey-box shapes. Frozen unless it will be animated.
 * Materials are shared by name and live for the whole session, so stages can
 * dispose their meshes every round without leaking or double-freeing materials.
 */
export function flatMaterial(scene: Scene, name: string, hex: string, animated = false): StandardMaterial {
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.specularColor = Color3.Black();
  if (!animated) material.freeze();
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

export interface SectorOptions {
  /**
   * Cross-section from the centre outwards as [radius, height] points. The
   * solid below it is filled in, so [[0, h], [R, h], [R, 0]] is a plain prism.
   */
  readonly profile: readonly (readonly [number, number])[];
  /** Angles from +x towards +z. A full circle omits the two cut faces. */
  readonly from: number;
  readonly to: number;
  /** Subtracted from every vertex, so the mesh origin can be the slice's centroid. */
  readonly origin: { x: number; z: number };
  /** UVs map the square of this half-size around the un-shifted centre onto the texture. */
  readonly uvRadius: number;
}

/**
 * A pizza slice (or a whole pizza) swept from a profile: smooth-shaded top
 * and rim, flat cut faces. UVs are planar from above, so slices keep showing
 * their part of the pizza texture. Use with back-face culling off.
 */
export function createSector(scene: Scene, name: string, o: SectorOptions): Mesh {
  const full = o.to - o.from >= Math.PI * 2 - 1e-6;
  const segments = Math.max(3, Math.ceil(((o.to - o.from) / (Math.PI * 2)) * 48));
  const profile = o.profile;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number): number => {
    positions.push(x - o.origin.x, y, z - o.origin.z);
    normals.push(nx, ny, nz);
    uvs.push(x / (o.uvRadius * 2) + 0.5, z / (o.uvRadius * 2) + 0.5);
    return positions.length / 3 - 1;
  };

  // Outward normal of each profile point in the (radius, height) plane, averaged for smooth shading.
  const profileNormals = profile.map((_, k) => {
    let nr = 0;
    let ny = 0;
    for (const j of [k - 1, k]) {
      const p0 = profile[j];
      const p1 = profile[j + 1];
      if (!p0 || !p1) continue;
      const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      nr += -(p1[1] - p0[1]) / length;
      ny += (p1[0] - p0[0]) / length;
    }
    const length = Math.hypot(nr, ny) || 1;
    return [nr / length, ny / length] as const;
  });

  // The swept surface: a grid of (angle, profile point) vertices.
  const columns = segments + 1;
  for (let i = 0; i <= segments; i++) {
    const angle = o.from + ((o.to - o.from) * i) / segments;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    profile.forEach(([r, y], k) => {
      const [nr, ny] = profileNormals[k] ?? [0, 1];
      push(cos * r, y, sin * r, cos * nr, ny, sin * nr);
    });
  }
  for (let i = 0; i < columns - 1; i++) {
    for (let k = 0; k < profile.length - 1; k++) {
      const a = i * profile.length + k;
      const b = (i + 1) * profile.length + k;
      indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }

  // Flat cut faces: a fan over the cross-section, from the axis at counter level.
  if (!full) {
    for (const [angle, sign] of [
      [o.from, 1],
      [o.to, -1],
    ] as const) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = sin * sign;
      const nz = -cos * sign;
      const hub = push(0, 0, 0, nx, 0, nz);
      const first = positions.length / 3;
      for (const [r, y] of profile) push(cos * r, y, sin * r, nx, 0, nz);
      for (let k = 0; k < profile.length - 1; k++) indices.push(hub, first + k, first + k + 1);
    }
  }

  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  return mesh;
}

/** Adapts a Babylon node to the PieceView the drag logic drives. */
export class NodeView implements PieceView {
  constructor(
    readonly node: TransformNode,
    private readonly baseScale = 1,
    private readonly disposeNode = true,
  ) {}

  setPosition(p: Vec3): void {
    this.node.position.set(p.x, p.y, p.z);
  }

  setScale(s: number): void {
    this.node.scaling.setAll(s * this.baseScale);
  }

  dispose(): void {
    if (this.disposeNode) this.node.dispose();
  }
}
