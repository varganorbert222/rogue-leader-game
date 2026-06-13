import { Mesh, Quaternion } from '@babylonjs/core';
import { configureColliderMesh, detectColliderMeshes, isVisualColliderMesh } from './collider-mesh-detector';
import type { LoadedEntity } from './gltf-ship-loader';

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
    configureColliderMesh(mesh);
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
