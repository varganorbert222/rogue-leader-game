import { Material, MultiMaterial, type AbstractMesh } from '@babylonjs/core';

function disableMaterialBackfaceCulling(material: Material | null | undefined): void {
  if (!material) return;
  if (material instanceof MultiMaterial) {
    for (const sub of material.subMaterials) {
      if (sub) sub.backFaceCulling = false;
    }
    return;
  }
  material.backFaceCulling = false;
}

/** Disable backface culling on all materials used by the given meshes. */
export function disableMeshBackfaceCulling(meshes: AbstractMesh[]): void {
  for (const mesh of meshes) {
    disableMaterialBackfaceCulling(mesh.material);
  }
}
