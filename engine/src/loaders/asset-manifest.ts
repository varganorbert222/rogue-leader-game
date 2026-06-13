export interface ShipAnchorBindings {
  /** slotId → weapon definition id from weapons manifest */
  weapons?: Record<string, string>;
  /** slotId → engine VFX profile id from weapons manifest */
  engines?: Record<string, string>;
}

import type { ShipAxisConventionConfig } from './ship-axis-convention';
import type { LodManifestValue } from './lod-config';

export interface ShipFlightStatsManifest {
  maxSpeed?: number;
  minSpeed?: number;
  boostMultiplier?: number;
  pitchRate?: number;
  yawRate?: number;
  rollRate?: number;
  thrustRate?: number;
  brakeRate?: number;
  cruiseSpeed?: number;
}

export interface ShipManifestEntry {
  lod?: LodManifestValue;
  /** Wreck / debris GLB (`*_x_LOD*.glb`). Auto-derived from first LOD path when omitted. */
  wreck?: string;
  scale: number | [number, number, number];
  colliderRadius: number;
  /** Visual-only export axis fix on the model pivot (default +z / +x). */
  axes?: Partial<ShipAxisConventionConfig>;
  faction?: 'rebel' | 'imperial' | 'neutral';
  flight?: ShipFlightStatsManifest;
  /** Per-slot overrides; missing slots use defaultWeapons by delivery kind. */
  anchors?: ShipAnchorBindings;
  /** Fallback weapon ids keyed by delivery (laser / projectile). */
  defaultWeapons?: Partial<Record<'laser' | 'projectile', string>>;
  /** glTF skeletal / morph animations and ship-specific abilities. */
  animations?: ShipAnimationManifest;
  abilities?: ShipAbilitiesManifest;
}

export interface ShipAnimationTransitionDef {
  clip: string;
  speed: number;
  toState: string;
}

export interface ShipAnimationManifest {
  initialState: string;
  transitions: ShipAnimationTransitionDef[];
}

export interface ShipSfoilSfxManifest {
  /** Directory under `/assets` (default `audio/sfx/xwing`). */
  basePath?: string;
  /** Wav file names — one is picked at random per toggle. */
  files: string[];
}

export interface ShipSfoilAbilityManifest {
  /** Uses `animations` when set; otherwise falls back to ship-level `animations`. */
  animation?: ShipAnimationManifest;
  /** Folded / closing attack-run speed boost (default 1.6). */
  closingBoostMultiplier?: number;
  /**
   * S-foil sfx — library clip id, list of clip ids (random), or inline wav variants.
   * @example "xwing_sfoil"
   * @example ["xwing_sfoil_01", "xwing_sfoil_02"]
   * @example { "basePath": "audio/sfx/xwing", "files": ["xwing_sfoil_01.wav", "xwing_sfoil_02.wav"] }
   */
  sfx?: string | string[] | ShipSfoilSfxManifest;
  /** Logical states toggled by the S-foil input (defaults below). */
  foldedState?: string;
  openState?: string;
}

export interface ShipAbilitiesManifest {
  sfoil?: ShipSfoilAbilityManifest;
}

export interface PropManifestEntry {
  lod?: LodManifestValue;
  /** GLB paths for visual variants — each loaded once, then picked at random when spawning. */
  variants?: string[];
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
