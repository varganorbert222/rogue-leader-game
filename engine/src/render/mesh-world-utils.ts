import type { AbstractMesh, TransformNode } from '@babylonjs/core';

/** Recompute world matrix before bounds tests or raycasts. */
export function ensureMeshWorldMatrix(mesh: AbstractMesh): void {
  mesh.computeWorldMatrix(true);
}

/** Recompute world matrix for a transform root or instanced hierarchy. */
export function ensureNodeWorldMatrix(node: TransformNode): void {
  node.computeWorldMatrix(true);
}
