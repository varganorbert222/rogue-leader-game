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

function materialHasEmissive(material: PBRMaterial | StandardMaterial): boolean {
  if (material.emissiveTexture) return true;
  const { r, g, b } = material.emissiveColor;
  return r + g + b > 1e-4;
}

function applyMaterialEmissiveBloomStrength(
  material: Material | null | undefined,
  strength: number,
): void {
  if (!material || strength === 1) return;
  if (material instanceof MultiMaterial) {
    for (const sub of material.subMaterials) {
      applyMaterialEmissiveBloomStrength(sub, strength);
    }
    return;
  }
  if (material instanceof PBRMaterial) {
    if (!materialHasEmissive(material)) return;
    material.emissiveIntensity *= strength;
    return;
  }
  if (material instanceof StandardMaterial) {
    if (!materialHasEmissive(material)) return;
    material.emissiveColor.scaleInPlace(strength);
  }
}

/** Scale emissive output on meshes that use emissive maps/colors (for bloom tuning). */
export function applyMeshEmissiveBloomStrength(
  meshes: readonly AbstractMesh[],
  strength: number,
): void {
  if (strength === 1) return;
  const seen = new Set<Material>();
  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material || seen.has(material)) continue;
    seen.add(material);
    applyMaterialEmissiveBloomStrength(material, strength);
  }
}
