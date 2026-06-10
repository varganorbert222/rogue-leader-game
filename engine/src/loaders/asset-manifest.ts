export interface ShipAnchorBindings {
  /** slotId → weapon definition id from weapons manifest */
  weapons?: Record<string, string>;
  /** slotId → engine VFX profile id from weapons manifest */
  engines?: Record<string, string>;
}

import type { ShipAxisConventionConfig } from './ship-axis-convention';

export interface ShipManifestEntry {
  lod: string[];
  scale: number | [number, number, number];
  colliderRadius: number;
  /** Visual-only export axis fix on the model pivot (default +z / +x). */
  axes?: Partial<ShipAxisConventionConfig>;
  faction?: 'rebel' | 'imperial' | 'neutral';
  /** Per-slot overrides; missing slots use defaultWeapons by delivery kind. */
  anchors?: ShipAnchorBindings;
  /** Fallback weapon ids keyed by delivery (laser / projectile). */
  defaultWeapons?: Partial<Record<'laser' | 'projectile', string>>;
}

export interface PropManifestEntry {
  lod?: string[];
  /** Folder of numbered GLB variants, e.g. meteor_01.glb in models/props/meteor */
  variantDir?: string;
  variantPrefix?: string;
  variantPad?: number;
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
