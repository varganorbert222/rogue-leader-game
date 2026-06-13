import type { LoadedEntity } from './gltf-ship-loader';

/** Show or hide every visual mesh on a loaded ship/prop hierarchy. */
export function setLoadedEntityVisible(loaded: LoadedEntity, visible: boolean): void {
  loaded.root.setEnabled(visible);
  for (const mesh of loaded.meshes) {
    mesh.isVisible = visible;
    mesh.setEnabled(visible);
  }
  for (const mesh of loaded.colliderMeshes) {
    mesh.setEnabled(visible);
    mesh.isVisible = false;
    mesh.visibility = 0;
  }
}
