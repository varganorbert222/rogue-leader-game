import {
  Matrix,
  Mesh,
  Quaternion,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import type { LoadedEntity } from '../loaders/gltf-ship-loader';

export interface ThinInstanceTransform {
  position: Vector3;
  rotationQuaternion: Quaternion;
  uniformScale: number;
}

interface Slot {
  id: string;
}

/**
 * GPU thin-instanced draw batch for one prop/asteroid variant.
 * Source meshes are hidden; only thin instances are rendered (1 draw call / submesh).
 */
export class ThinInstanceBatch {
  private readonly managerRoot: TransformNode;
  private readonly sourceMeshes: Mesh[] = [];
  private readonly slots: Slot[] = [];
  private readonly idToIndex = new Map<string, number>();
  private readonly matrixScratch = Matrix.Identity();
  private liveCount = 0;
  private dirty = false;

  private constructor(
    scene: Scene,
    name: string,
    sourceMeshes: Mesh[],
  ) {
    this.managerRoot = new TransformNode(`${name}_thinRoot`, scene);
    this.sourceMeshes = sourceMeshes;
    for (const mesh of sourceMeshes) {
      mesh.parent = this.managerRoot;
      mesh.position.setAll(0);
      mesh.rotationQuaternion = Quaternion.Identity();
      mesh.scaling.setAll(1);
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.thinInstanceEnablePicking = false;
      mesh.thinInstanceAllowAutomaticStaticBufferRecreation = true;
      mesh.thinInstanceCount = 0;
    }
  }

  static fromLoadedEntity(
    scene: Scene,
    name: string,
    template: LoadedEntity,
  ): ThinInstanceBatch {
    const colliderSet = new Set(template.colliderMeshes);
    const lod0 = template.lodMeshes[0] ?? template.meshes;
    const sources: Mesh[] = [];

    for (const mesh of lod0) {
      if (!(mesh instanceof Mesh)) continue;
      if (colliderSet.has(mesh)) continue;
      sources.push(mesh);
    }

    if (sources.length === 0) {
      for (const mesh of template.meshes) {
        if (!(mesh instanceof Mesh)) continue;
        if (colliderSet.has(mesh)) continue;
        sources.push(mesh);
      }
    }

    return new ThinInstanceBatch(scene, name, sources);
  }

  get root(): TransformNode {
    return this.managerRoot;
  }

  get count(): number {
    return this.liveCount;
  }

  add(id: string, transform: ThinInstanceTransform): number {
    const existing = this.idToIndex.get(id);
    if (existing !== undefined) {
      this.setTransform(existing, transform);
      return existing;
    }

    const index = this.liveCount;
    this.slots[index] = { id };
    this.idToIndex.set(id, index);
    this.liveCount++;
    this.writeMatrix(index, transform);
    this.dirty = true;
    return index;
  }

  setTransform(index: number, transform: ThinInstanceTransform): void {
    if (index < 0 || index >= this.liveCount) return;
    this.writeMatrix(index, transform);
    this.dirty = true;
  }

  setTransformById(id: string, transform: ThinInstanceTransform): void {
    const index = this.idToIndex.get(id);
    if (index === undefined) return;
    this.setTransform(index, transform);
  }

  remove(id: string): string | null {
    const index = this.idToIndex.get(id);
    if (index === undefined) return null;

    const last = this.liveCount - 1;
    let movedId: string | null = null;
    if (index !== last) {
      const moved = this.slots[last];
      movedId = moved.id;
      this.slots[index] = moved;
      this.idToIndex.set(moved.id, index);
      for (const mesh of this.sourceMeshes) {
        const matrices = mesh.thinInstanceGetWorldMatrices();
        const lastMatrix = matrices[last] ?? Matrix.Identity();
        mesh.thinInstanceSetMatrixAt(index, lastMatrix, false);
      }
    }

    this.slots.pop();
    this.idToIndex.delete(id);
    this.liveCount--;
    this.dirty = true;
    return movedId;
  }

  getIndexForId(id: string): number | undefined {
    return this.idToIndex.get(id);
  }

  flush(): void {
    if (!this.dirty) return;
    for (const mesh of this.sourceMeshes) {
      mesh.thinInstanceCount = this.liveCount;
      mesh.thinInstanceRefreshBoundingInfo(true);
    }
    this.dirty = false;
  }

  dispose(): void {
    for (const mesh of this.sourceMeshes) {
      mesh.thinInstanceCount = 0;
      mesh.dispose();
    }
    this.sourceMeshes.length = 0;
    this.managerRoot.dispose();
    this.slots.length = 0;
    this.idToIndex.clear();
    this.liveCount = 0;
  }

  private writeMatrix(index: number, transform: ThinInstanceTransform): void {
    const scale = transform.uniformScale;
    Matrix.ComposeToRef(
      new Vector3(scale, scale, scale),
      transform.rotationQuaternion,
      transform.position,
      this.matrixScratch,
    );

    for (const mesh of this.sourceMeshes) {
      if (index === 0 && mesh.thinInstanceCount === 0 && this.liveCount === 1) {
        mesh.thinInstanceAdd(this.matrixScratch, false);
      } else if (index >= mesh.thinInstanceCount) {
        mesh.thinInstanceAdd(this.matrixScratch, false);
      } else {
        mesh.thinInstanceSetMatrixAt(index, this.matrixScratch, false);
      }
    }
  }
}

export function composeThinInstanceTransform(
  position: Vector3,
  rotationQuaternion: Quaternion,
  uniformScale: number,
): ThinInstanceTransform {
  return {
    position: position.clone(),
    rotationQuaternion: rotationQuaternion.clone(),
    uniformScale,
  };
}

export function extractInstancingSourceMeshes(
  template: LoadedEntity,
): readonly AbstractMesh[] {
  const colliderSet = new Set(template.colliderMeshes);
  const lod0 = template.lodMeshes[0] ?? template.meshes;
  return lod0.filter(
    (mesh) => mesh instanceof Mesh && !colliderSet.has(mesh as Mesh),
  );
}
