import { Mesh, TransformNode, type AbstractMesh } from '@babylonjs/core';
import { normalizeAnchorNodeName } from './ship-anchor-detector';

const COLLIDER_PREFIX = 'collider_';

function walkSceneNodes(
  root: TransformNode,
  visit: (node: TransformNode | AbstractMesh) => void
): void {
  const stack: TransformNode[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of current.getChildren()) {
      if (child instanceof Mesh) {
        visit(child);
        stack.push(child);
      } else if (child instanceof TransformNode) {
        visit(child);
        stack.push(child);
      }
    }
  }
}

function colliderLeafName(name: string): string {
  const normalized = normalizeAnchorNodeName(name).toLowerCase();
  return normalized.split('.').pop() ?? normalized;
}

function isColliderMeshName(name: string): boolean {
  const leaf = colliderLeafName(name);
  return leaf === 'collider' || leaf.startsWith(COLLIDER_PREFIX);
}

function isColliderMesh(mesh: Mesh): boolean {
  if (mesh.metadata?.usesVisualCollider === true) return false;
  if (mesh.metadata?.isColliderMesh === true) return true;
  return isColliderMeshName(mesh.name);
}

export function isVisualColliderMesh(mesh: AbstractMesh): boolean {
  return mesh.metadata?.usesVisualCollider === true;
}

/** Hide collider-only geometry while keeping transforms active for collision. */
export function configureColliderMesh(mesh: Mesh): void {
  mesh.isVisible = false;
  mesh.visibility = 0;
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.receiveShadows = false;
  if (mesh.material) {
    mesh.material.alpha = 0;
  }
  mesh.metadata = { ...(mesh.metadata ?? {}), isColliderMesh: true };
}

/**
 * Find `collider` or `collider_*` child meshes anywhere under root, configure them as invisible
 * collision geometry, and return the mesh list (moves with animated parents).
 */
export function detectColliderMeshes(root: TransformNode): Mesh[] {
  const colliders: Mesh[] = [];
  const seen = new Set<Mesh>();

  walkSceneNodes(root, (node) => {
    if (!(node instanceof Mesh)) return;
    if (!isColliderMesh(node)) return;
    if (seen.has(node)) return;
    seen.add(node);
    configureColliderMesh(node);
    colliders.push(node);
  });

  return colliders;
}

export function filterVisualMeshes(
  meshes: readonly AbstractMesh[],
  colliders: readonly AbstractMesh[]
): AbstractMesh[] {
  if (!colliders.length) return [...meshes];
  const colliderSet = new Set(colliders);
  return meshes.filter((mesh) => !colliderSet.has(mesh));
}

export function filterVisualLodMeshes(
  lodMeshes: AbstractMesh[][],
  colliders: readonly AbstractMesh[]
): AbstractMesh[][] {
  if (!colliders.length) return lodMeshes.map((group) => [...group]);
  return lodMeshes.map((group) => filterVisualMeshes(group, colliders));
}

/** Use visible render meshes as collision geometry (asteroids stay visible). */
export function applyVisualMeshColliders(loaded: {
  meshes: readonly AbstractMesh[];
  colliderMeshes: Mesh[];
}): void {
  loaded.colliderMeshes.length = 0;
  for (const mesh of loaded.meshes) {
    if (!(mesh instanceof Mesh)) continue;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { ...(mesh.metadata ?? {}), usesVisualCollider: true };
    loaded.colliderMeshes.push(mesh);
  }
}

export function applyPropColliderPolicy(
  loaded: { meshes: readonly AbstractMesh[]; colliderMeshes: Mesh[] },
  entry: { colliderSource?: "named" | "visual" },
): void {
  if (entry.colliderSource === "visual") {
    applyVisualMeshColliders(loaded);
  }
}
