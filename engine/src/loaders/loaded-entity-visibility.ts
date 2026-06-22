import { Mesh, Material, Quaternion, type AbstractMesh } from '@babylonjs/core';
import { clearLoadedEntityWireDebugMetadata } from '../render/debug/collider-wireframe-debug';
import { configureColliderMesh, detectColliderMeshes, hasColliderGeometry, isVisualColliderMesh } from './collider-mesh-detector';
import type { LoadedEntity } from './gltf-ship-loader';
import { collectDescendantMeshes } from './clone-entity-utils';
import { applyLodVisibility, invalidateLodRuntime } from './lod-runtime';

/** Show or hide every visual mesh on a loaded ship/prop hierarchy. */
export function setLoadedEntityVisible(loaded: LoadedEntity, visible: boolean): void {
  loaded.root.setEnabled(visible);

  for (const mesh of loaded.meshes) {
    mesh.isVisible = visible;
    mesh.setEnabled(visible);
  }

  for (const mesh of loaded.colliderMeshes) {
    if (isVisualColliderMesh(mesh)) {
      mesh.setEnabled(visible);
      mesh.isVisible = visible;
      mesh.visibility = visible ? 1 : 0;
      continue;
    }
    if (mesh instanceof Mesh) {
      configureColliderMesh(mesh);
    }
    mesh.setEnabled(visible);
    mesh.isVisible = false;
    mesh.visibility = 0;
  }
}

/** Re-scan collider meshes after clone/pool reuse (Babylon renames nodes on clone). */
export function refreshLoadedEntityColliders(loaded: LoadedEntity): void {
  const colliders = detectColliderMeshes(loaded.root);
  loaded.colliderMeshes.length = 0;
  loaded.colliderMeshes.push(...colliders);

  const colliderSet = new Set(colliders);
  for (let i = loaded.meshes.length - 1; i >= 0; i--) {
    if (colliderSet.has(loaded.meshes[i] as Mesh)) {
      loaded.meshes.splice(i, 1);
    }
  }
}

/** Reset root transform before respawning a pooled ship instance. */
export function resetLoadedEntityTransform(loaded: LoadedEntity): void {
  loaded.root.position.setAll(0);
  loaded.root.rotationQuaternion = Quaternion.Identity();
  loaded.root.rotation.setAll(0);
}

/** Clear wireframe rendering left on pooled materials (e.g. dev preview / debug overlays). */
export function resetLoadedEntityMaterialWireframe(loaded: LoadedEntity): void {
  const seen = new Set<Material>();
  const visit = (mesh: AbstractMesh): void => {
    const mat = mesh.material;
    if (!mat || seen.has(mat) || !('wireframe' in mat)) return;
    seen.add(mat);
    (mat as Material & { wireframe: boolean }).wireframe = false;
  };

  for (const mesh of loaded.meshes) visit(mesh);
  for (const group of loaded.lodMeshes) {
    for (const mesh of group) visit(mesh);
  }
  for (const mesh of loaded.colliderMeshes) visit(mesh);
}

/** Dev prefab/model previews: props with visual colliders are hidden at load for instancing. */
export function showLoadedEntityForDevPreview(loaded: LoadedEntity): void {
  loaded.root.setEnabled(true);
  clearLoadedEntityWireDebugMetadata(loaded);
  resetLoadedEntityMaterialWireframe(loaded);

  for (const mesh of collectDescendantMeshes(loaded.root)) {
    if (!hasColliderGeometry(mesh)) continue;

    if (mesh.metadata?.isColliderMesh && !isVisualColliderMesh(mesh)) {
      if (mesh instanceof Mesh) configureColliderMesh(mesh);
      continue;
    }

    mesh.setEnabled(true);
    mesh.isVisible = true;
    mesh.visibility = 1;
  }

  if (loaded.lodMeshes.length > 0) {
    invalidateLodRuntime(loaded.lodRuntime);
    applyLodVisibility(loaded.lodMeshes, 0);
  }
}

/** Re-enable hierarchy, refresh colliders, and reset LOD after pool acquire. */
export function prepareLoadedEntityForAcquire(loaded: LoadedEntity): void {
  loaded.root.setEnabled(true);
  clearLoadedEntityWireDebugMetadata(loaded);
  resetLoadedEntityMaterialWireframe(loaded);
  refreshLoadedEntityColliders(loaded);
  setLoadedEntityVisible(loaded, true);
  invalidateLodRuntime(loaded.lodRuntime);
}

/** Hide a pooled ship and clear collider debug overlay state. */
export function prepareLoadedEntityForPool(loaded: LoadedEntity): void {
  clearLoadedEntityWireDebugMetadata(loaded);
  setLoadedEntityVisible(loaded, false);
}
