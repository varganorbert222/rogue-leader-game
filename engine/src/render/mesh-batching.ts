import {
  AbstractMesh,
  Material,
  type Mesh,
} from '@babylonjs/core';
import type { LoadedEntity } from '../loaders/gltf-ship-loader';
import { remapMeshGroupByName } from '../loaders/clone-entity-utils';

/** Reuse template materials on clones so identical ships share one material per submesh. */
export function shareMaterialsFromTemplate(
  templateMeshes: readonly AbstractMesh[],
  templateRoot: import('@babylonjs/core').TransformNode,
  cloneMeshes: readonly AbstractMesh[],
  cloneRoot: import('@babylonjs/core').TransformNode,
): void {
  const remapped = remapMeshGroupByName(
    templateMeshes,
    templateRoot,
    cloneRoot,
  );
  const pairs =
    remapped.length === cloneMeshes.length
      ? remapped.map((templateMesh, i) => [templateMesh, cloneMeshes[i]] as const)
      : templateMeshes.map((templateMesh, i) => [
          templateMesh,
          cloneMeshes[i],
        ] as const);

  const seen = new Set<Material>();
  for (const [templateMesh, cloneMesh] of pairs) {
    if (!templateMesh?.material || !cloneMesh) continue;
    cloneMesh.material = templateMesh.material;
    seen.add(templateMesh.material);
  }

  for (const material of seen) {
    material.freeze();
  }
}

/** Reduce per-mesh overhead for many moving entities (ships, props). */
export function optimizeMeshesForRendering(meshes: readonly AbstractMesh[]): void {
  for (const mesh of meshes) {
    mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
    mesh.isBlocker = false;
    mesh.doNotSyncBoundingInfo = false;
  }
}

export function optimizeLoadedEntityMeshes(entity: LoadedEntity): void {
  optimizeMeshesForRendering(entity.meshes);
  for (const group of entity.lodMeshes) {
    optimizeMeshesForRendering(group);
  }
  for (const collider of entity.colliderMeshes) {
    collider.isPickable = false;
    collider.isVisible = false;
  }
}
