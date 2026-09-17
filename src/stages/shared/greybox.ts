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
  readonly radius: number;
  readonly height: number;
  /** Angles from +x towards +z. A full circle omits the two cut faces. */
  readonly from: number;
  readonly to: number;
  /** Subtracted from every vertex, so the mesh origin can be the slice's centroid. */
  readonly origin: { x: number; z: number };
  /** UVs map the square of this half-size around the un-shifted centre onto the texture. */
  readonly uvRadius: number;
}

/**
 * A pizza-slice prism (or a full disc): top face, rim and cut faces. UVs are
 * planar from above, so slices keep showing their part of the pizza texture.
 * Use with a material that has back-face culling off.
 */
export function createSector(scene: Scene, name: string, o: SectorOptions): Mesh {
  const full = o.to - o.from >= Math.PI * 2 - 1e-6;
  const segments = Math.max(3, Math.ceil(((o.to - o.from) / (Math.PI * 2)) * 48));
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
  const rim = (i: number): { x: number; z: number; nx: number; nz: number } => {
    const a = o.from + ((o.to - o.from) * i) / segments;
    return { x: Math.cos(a) * o.radius, z: Math.sin(a) * o.radius, nx: Math.cos(a), nz: Math.sin(a) };
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    indices.push(a, b, c, a, c, d);
  };

  const center = push(0, o.height, 0, 0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const p = rim(i);
    const top = push(p.x, o.height, p.z, 0, 1, 0);
    if (i > 0) indices.push(center, top - 1, top);
  }
  for (let i = 0; i < segments; i++) {
    const p = rim(i);
    const q = rim(i + 1);
    quad(
      push(p.x, o.height, p.z, p.nx, 0, p.nz),
      push(q.x, o.height, q.z, q.nx, 0, q.nz),
      push(q.x, 0, q.z, q.nx, 0, q.nz),
      push(p.x, 0, p.z, p.nx, 0, p.nz),
    );
  }
  if (!full) {
    for (const [i, sign] of [
      [0, 1],
      [segments, -1],
    ] as const) {
      const p = rim(i);
      const nx = p.nz * sign;
      const nz = -p.nx * sign;
      quad(
        push(0, o.height, 0, nx, 0, nz),
        push(p.x, o.height, p.z, nx, 0, nz),
        push(p.x, 0, p.z, nx, 0, nz),
        push(0, 0, 0, nx, 0, nz),
      );
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
