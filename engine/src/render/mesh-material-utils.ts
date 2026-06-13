import { Material, MultiMaterial, PBRMaterial, StandardMaterial, type AbstractMesh } from '@babylonjs/core';

const DEFAULT_ALPHA_CUTOFF = 0.5;

function applyMaterialAlphaCutoff(
  material: Material | null | undefined,
  cutoff: number
): void {
  if (!material) return;
  if (material instanceof MultiMaterial) {
    for (const sub of material.subMaterials) {
      applyMaterialAlphaCutoff(sub, cutoff);
    }
    return;
  }
  if (material instanceof PBRMaterial) {
    material.transparencyMode = PBRMaterial.MATERIAL_ALPHATEST;
    material.alphaCutOff = cutoff;
    material.useAlphaFromAlbedoTexture = true;
    return;
  }
  if (material instanceof StandardMaterial) {
    material.transparencyMode = Material.MATERIAL_ALPHATEST;
    material.alphaCutOff = cutoff;
    material.useAlphaFromDiffuseTexture = true;
  }
}

/** Enable alpha-test cutout on mesh materials (cutoff discard for textured debris). */
export function applyMeshAlphaCutoff(
  meshes: AbstractMesh[],
  cutoff = DEFAULT_ALPHA_CUTOFF
): void {
  for (const mesh of meshes) {
    applyMaterialAlphaCutoff(mesh.material, cutoff);
  }
}

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
