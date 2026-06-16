import type { ParticleAlbedoTextureEditable } from './types';

export function atlasFrameCount(albedo: ParticleAlbedoTextureEditable): number {
  if (!albedo.isAtlas) return 1;
  return Math.max(1, albedo.endCellIndex - albedo.startCellIndex + 1);
}

export function isAnimatedParticleAtlas(albedo: ParticleAlbedoTextureEditable): boolean {
  return albedo.isAtlas && atlasFrameCount(albedo) >= 2;
}

export function clampAtlasCellIndex(albedo: ParticleAlbedoTextureEditable, index: number): number {
  const maxCell = Math.max(albedo.startCellIndex, albedo.endCellIndex, albedo.cellIndex);
  return Math.max(0, Math.min(index, maxCell));
}

export function syncStaticAtlasCell(
  albedo: ParticleAlbedoTextureEditable,
): ParticleAlbedoTextureEditable {
  if (!albedo.isAtlas || isAnimatedParticleAtlas(albedo)) return albedo;
  const cell = clampAtlasCellIndex(albedo, albedo.cellIndex);
  return {
    ...albedo,
    cellIndex: cell,
    startCellIndex: cell,
    endCellIndex: cell,
  };
}
