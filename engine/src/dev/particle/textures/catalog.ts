import { RuntimePaths } from '../../../runtime-paths';
import { DevConfigPaths } from '../../dev-config-paths';
import type { ParticleAlbedoTextureEditable } from '../types';

export const PARTICLE_TEXTURES_DIR = 'textures/particles';

export interface ParticleTextureAtlasConfig {
  tileWidth: number;
  tileHeight: number;
}

export interface ParticleTextureEntry {
  id: string;
  label: string;
  file: string;
  width: number;
  height: number;
  atlas?: ParticleTextureAtlasConfig;
}

const FALLBACK_TEXTURES: ParticleTextureEntry[] = [
  { id: 'flare', label: 'Flare', file: 'flare.png', width: 512, height: 512 },
];

function normalizeTextureEntry(entry: ParticleTextureEntry): ParticleTextureEntry {
  const width = entry.width > 0 ? entry.width : 512;
  const height = entry.height > 0 ? entry.height : 512;
  if (!entry.atlas) {
    return { ...entry, width, height };
  }
  return {
    ...entry,
    width,
    height,
    atlas: {
      tileWidth: entry.atlas.tileWidth > 0 ? entry.atlas.tileWidth : width,
      tileHeight: entry.atlas.tileHeight > 0 ? entry.atlas.tileHeight : height,
    },
  };
}

export function syncAlbedoTextureFromCatalog(
  albedo: ParticleAlbedoTextureEditable,
): ParticleAlbedoTextureEditable {
  if (!albedo.textureId) {
    return { ...albedo, isAtlas: false };
  }

  const entry = getParticleTextureEntry(albedo.textureId);
  if (!entry) return albedo;

  const isAtlas = !!entry.atlas;
  const tileWidth = entry.atlas?.tileWidth ?? entry.width;
  const tileHeight = entry.atlas?.tileHeight ?? entry.height;

  return {
    ...albedo,
    isAtlas,
    tileWidth,
    tileHeight,
  };
}

let catalogById = new Map<string, ParticleTextureEntry>(
  FALLBACK_TEXTURES.map((entry) => [entry.id, entry]),
);

export function particleTextureAssetUrl(fileName: string): string {
  return `${RuntimePaths.assetsBase}/${PARTICLE_TEXTURES_DIR}/${fileName}`;
}

export function setParticleTextureCatalog(entries: readonly ParticleTextureEntry[]): void {
  catalogById = new Map(entries.map((entry) => [entry.id, normalizeTextureEntry(entry)]));
}

export function listParticleTextures(): ParticleTextureEntry[] {
  return [...catalogById.values()];
}

export function getParticleTextureEntry(textureId: string): ParticleTextureEntry | undefined {
  return catalogById.get(textureId);
}

export function resolveParticleTextureUrlById(textureId: string): string | null {
  if (!textureId) return null;
  const entry = catalogById.get(textureId);
  const file = entry?.file ?? `${textureId}.png`;
  return particleTextureAssetUrl(file);
}

export function resolveAlbedoTextureUrl(albedo: ParticleAlbedoTextureEditable): string | null {
  return resolveParticleTextureUrlById(albedo.textureId);
}

export async function loadParticleTextureCatalog(): Promise<ParticleTextureEntry[]> {
  try {
    const res = await fetch(DevConfigPaths.particleEditor.textures);
    if (!res.ok) {
      setParticleTextureCatalog(FALLBACK_TEXTURES);
      return [...FALLBACK_TEXTURES];
    }
    const json = (await res.json()) as { textures?: ParticleTextureEntry[] };
    const textures = (json.textures?.length ? json.textures : FALLBACK_TEXTURES).map(
      normalizeTextureEntry,
    );
    setParticleTextureCatalog(textures);
    return [...textures];
  } catch {
    setParticleTextureCatalog(FALLBACK_TEXTURES);
    return [...FALLBACK_TEXTURES];
  }
}

export function countAtlasCells(
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
): number {
  if (tileWidth <= 0 || tileHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) return 1;
  const cols = Math.max(1, Math.floor(imageWidth / tileWidth));
  const rows = Math.max(1, Math.floor(imageHeight / tileHeight));
  return cols * rows;
}

export function atlasCellColumn(cellIndex: number, imageWidth: number, tileWidth: number): number {
  const cols = Math.max(1, Math.floor(imageWidth / Math.max(1, tileWidth)));
  return cellIndex % cols;
}

export function atlasCellRow(cellIndex: number, imageWidth: number, tileWidth: number): number {
  const cols = Math.max(1, Math.floor(imageWidth / Math.max(1, tileWidth)));
  return Math.floor(cellIndex / cols);
}
