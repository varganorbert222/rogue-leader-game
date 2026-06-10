export interface ShipManifestEntry {
  lod: string[];
  scale: number | [number, number, number];
  colliderRadius: number;
}

export interface PropManifestEntry {
  lod: string[];
  scale: number | [number, number];
  colliderRadius: number;
}

export interface SkyboxManifestEntry {
  type: 'cubemap';
  faces: string[];
}

export interface AssetManifest {
  ships: Record<string, ShipManifestEntry>;
  props: Record<string, PropManifestEntry>;
  skyboxes: Record<string, SkyboxManifestEntry>;
}

const warned = new Set<string>();

export async function loadAssetManifest(url: string): Promise<AssetManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load asset manifest: ${url}`);
  return (await res.json()) as AssetManifest;
}

export function warnMissingOnce(id: string): void {
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(`[Assets] missing: ${id} — using placeholder`);
  }
}
