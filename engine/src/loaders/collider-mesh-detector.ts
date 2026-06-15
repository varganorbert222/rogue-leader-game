import { Mesh, TransformNode, type AbstractMesh } from '@babylonjs/core';
import {
  collectDescendantMeshes,
  meshLookupLeafKey,
  walkSceneNodes,
} from './scene-graph-utils';

const COLLIDER_PREFIX = 'collider_';

function isColliderMeshName(name: string): boolean {
  const leaf = meshLookupLeafKey(name);
  return leaf === 'collider' || leaf.startsWith(COLLIDER_PREFIX);
}

function isColliderMesh(mesh: Mesh): boolean {
  if (mesh.metadata?.usesVisualCollider === true) return false;
  if (mesh.metadata?.isColliderMesh === true) return true;
  return isColliderMeshName(mesh.name);
}

/** Classify meshes for hierarchy outliner (colliders hidden by default). */
export function isHierarchyColliderMesh(mesh: Mesh): boolean {
  return isColliderMesh(mesh);
}

export function isVisualColliderMesh(mesh: AbstractMesh): boolean {
  return mesh.metadata?.usesVisualCollider === true;
}

/** Any render/collider mesh with real geometry (includes Babylon 7 InstancedMesh). */
export function hasColliderGeometry(mesh: AbstractMesh): boolean {
  return !mesh.isDisposed() && mesh.getTotalVertices() > 0;
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

/** Render meshes for hangar / ship-select wireframe preview (no colliders or empty geometry). */
export function collectShipPreviewVisualMeshes(root: TransformNode): AbstractMesh[] {
  const colliders = detectColliderMeshes(root);
  const colliderSet = new Set<AbstractMesh>(colliders);
  for (const collider of colliders) {
    collider.setEnabled(false);
  }

  return collectDescendantMeshes(root).filter((mesh) => {
    if (colliderSet.has(mesh)) return false;
    if (!hasColliderGeometry(mesh)) return false;
    if (mesh instanceof Mesh && isColliderMesh(mesh)) return false;
    return true;
  });
}

/** Use visible render meshes as collision geometry (asteroids stay visible). */
export function applyVisualMeshColliders(loaded: {
  meshes: readonly AbstractMesh[];
  colliderMeshes: AbstractMesh[];
}): void {
  loaded.colliderMeshes.length = 0;
  for (const mesh of loaded.meshes) {
    if (!hasColliderGeometry(mesh)) continue;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { ...(mesh.metadata ?? {}), usesVisualCollider: true };
    loaded.colliderMeshes.push(mesh);
  }
}

export function applyPropColliderPolicy(
  loaded: { meshes: readonly AbstractMesh[]; colliderMeshes: AbstractMesh[] },
  entry: { colliderSource?: "named" | "visual" },
): void {
  if (entry.colliderSource === "visual") {
    applyVisualMeshColliders(loaded);
  }
}
