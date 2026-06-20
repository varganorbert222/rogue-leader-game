export interface ShipAnchorBindings {
  /** @deprecated Use `weapons.slots` */
  weapons?: Record<string, string>;
  /** slotId → engine VFX profile id from weapons manifest */
  engines?: Record<string, string>;
}

import type { ShipAxisConventionConfig } from './ship-axis-convention';
import type { LodManifestValue } from './lod-config';
import type { CockpitConfig } from './cockpit-config';

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
  /** Destroyed-model GLB path override for dev tooling (`*_x_LOD*.glb`). Auto-derived when omitted. */
  wreck?: string;
  scale: number | [number, number, number];
  colliderRadius: number;
  /** Visual-only export axis fix on the model pivot (default +z / +x). */
  axes?: Partial<ShipAxisConventionConfig>;
  faction?: 'rebel' | 'imperial' | 'neutral';
  flight?: ShipFlightStatsManifest;
  /** Unified weapon loadout, definitions, groups, and energy pool. */
  weapons?: ShipWeaponsManifest;
  /** @deprecated Use `weapons.defaults` */
  defaultWeapons?: Partial<Record<'laser' | 'projectile', string>>;
  /** @deprecated Use `weapons.energy` */
  weaponEnergy?: ShipWeaponEnergyManifest;
  /** @deprecated Use `weapons.groups` */
  weaponGroups?: ShipWeaponGroupManifest[];
  /** Per-slot engine VFX overrides. */
  anchors?: ShipAnchorBindings;
  /** glTF skeletal / morph animations and ship-specific abilities. */
  animations?: ShipAnimationManifest;
  abilities?: ShipAbilitiesManifest;
  /** Cockpit interior GLB + first-person camera tuning. */
  cockpit?: CockpitConfig;
  /** Prefab library id spawned on death (wreck mesh + authored VFX). */
  deathPrefabId?: string;
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

/** Shared weapon energy pool tuning (per ship overrides on `weaponEnergy`). */
export interface ShipWeaponEnergyManifest {
  maxEnergy?: number;
  regenPerSec?: number;
  /** Seconds after a shot before energy regen resumes. */
  regenDelaySec?: number;
}

/** Player-defined firing group — mounts fire together / in pairs / sequentially by energy. */
export interface ShipWeaponGroupManifest {
  id: string;
  fireInput: 'primary' | 'secondary';
  /** Mount slot ids in firing order (`weapon_laser_01` → `"01"`). */
  slots: string[];
  /** Lasers default true; projectiles default false (ammo only). */
  usesEnergy?: boolean;
  energyCost?: number;
  pairThreshold?: number;
  fullFireThreshold?: number;
  /** Magazine size for projectile weapons in this group. */
  ammo?: number;
  /** Weapon manifest id for ammo tracking (defaults to bound projectile on first slot). */
  weaponId?: string;
  /**
   * Pair firing steps when energy is between pairThreshold and fullFireThreshold.
   * Each step is a list of slot ids that fire together, cycled sequentially.
   * @example [["01", "03"], ["02", "04"]]
   */
  pairSequence?: string[][];
  /**
   * Optional override for minimum seconds between volleys in this group.
   * Defaults to the longest `cooldownSec` among weapons assigned to the group.
   */
  fireRateSec?: number;
}

/** Partial weapon stat patch; `extends` inherits a global or ship definition. */
export interface ShipWeaponDefinitionPatch {
  extends?: string;
  delivery?: 'laser' | 'projectile';
  behavior?: string;
  faction?: 'rebel' | 'imperial' | 'neutral';
  fireGroup?: 'primary' | 'secondary' | 'all';
  cooldownSec?: number;
  damage?: number;
  visualProfile?: string;
  projectile?: {
    speed?: number;
    maxRange?: number;
    hitRadius?: number;
  };
  homing?: {
    turnRate?: number;
    acquireRange?: number;
  };
  audio?: {
    fire?: string;
    hit?: string;
  };
  /** Magazine size for this projectile weapon on this ship. */
  ammo?: number;
}

export interface ShipWeaponSlotManifest {
  weapon: string;
  overrides?: ShipWeaponDefinitionPatch;
}

/** Unified ship weapon configuration (loadout, defs, groups, energy). */
export interface ShipWeaponsManifest {
  defaults?: Partial<Record<'laser' | 'projectile', string>>;
  slots?: Record<string, string | ShipWeaponSlotManifest>;
  definitions?: Record<string, ShipWeaponDefinitionPatch>;
  groups?: ShipWeaponGroupManifest[];
  energy?: ShipWeaponEnergyManifest;
}

/** Use the prop's own visible mesh geometry for hit tests (e.g. asteroids). */
export type PropColliderSource = "named" | "visual";

export interface PropManifestEntry {
  lod?: LodManifestValue;
  /** GLB paths for visual variants — each loaded once, then picked at random when spawning. */
  variants?: string[];
  scale: number | [number, number];
  colliderRadius: number;
  /** `named` = `collider` / `collider_*` nodes; `visual` = render meshes (asteroids). */
  colliderSource?: PropColliderSource;
  /** Prefab library id spawned on death (wreck mesh + authored VFX). */
  deathPrefabId?: string;
}

export interface SkyboxCubemapEntry {
  type: 'cubemap';
  faces: string[];
}

export interface SkyboxPhotodomeEntry {
  type: 'photodome';
  /** Equirectangular spheremap textures (e.g. `*_01.png` … `*_N.png`). */
  textures: string[];
  resolution?: number;
  size?: number;
  useDirectMapping?: boolean;
}

export type SkyboxManifestEntry = SkyboxCubemapEntry | SkyboxPhotodomeEntry;

export interface AssetManifest {
  ships: Record<string, ShipManifestEntry>;
  props: Record<string, PropManifestEntry>;
  skyboxes: Record<string, SkyboxManifestEntry>;
}

const warned = new Set<string>();

export type { CockpitConfig, CockpitInputResponseConfig, ResolvedCockpitConfig } from './cockpit-config';
export {
  DEFAULT_COCKPIT_CONFIG,
  DEFAULT_COCKPIT_FOV_DEG,
  DEFAULT_COCKPIT_INPUT_RESPONSE,
  deriveCockpitModelPath,
  hasShipCockpit,
  resolveCockpitConfig,
  resolveCockpitModelPath,
  suggestCockpitModelPath,
} from './cockpit-config';

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
