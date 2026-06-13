import type { AbstractMesh, TransformNode, Vector3 } from '@babylonjs/core';
import type { LodRuntimeState } from '@rogue-leader/engine';

export interface AsteroidBodyComponent {
  variantIndex: number;
  root: TransformNode;
  lodRuntime: LodRuntimeState;
  colliderRadius: number;
  colliderMeshes: readonly AbstractMesh[];
  usesMeshCollider: boolean;
  tumbleAxis: Vector3;
  tumbleSpeed: number;
}
