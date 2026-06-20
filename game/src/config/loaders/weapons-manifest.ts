import type { ShipWeaponDefinitionPatch } from '@rogue-leader/engine';
import type { ProjectileVisualConfig } from '../../combat/projectiles/projectile-config';
import type { ResolvedShipWeaponsConfig } from './ship-weapons-config';

export type WeaponDelivery = 'laser' | 'projectile';
export type LaserBehavior = 'standard' | 'disabling' | 'ion';
export type ProjectileBehavior =
  | 'bolt'
  | 'bomb'
  | 'rocket'
  | 'missile_unguided'
  | 'missile_homing';
export type WeaponBehavior = LaserBehavior | ProjectileBehavior;
export type WeaponFireGroup = 'primary' | 'secondary' | 'all';
export type WeaponFaction = 'rebel' | 'imperial' | 'neutral';

export interface WeaponProjectileStats {
  speed: number;
  maxRange: number;
  hitRadius: number;
}

export interface WeaponHomingConfig {
  turnRate: number;
  acquireRange: number;
}

export interface WeaponAudioConfig {
  fire?: string;
  hit?: string;
}

export interface WeaponDefinitionEntry {
  delivery: WeaponDelivery;
  behavior: WeaponBehavior;
  faction?: WeaponFaction;
  fireGroup: WeaponFireGroup;
  cooldownSec: number;
  damage: number;
  visualProfile: string;
  projectile: WeaponProjectileStats;
  homing?: WeaponHomingConfig;
  audio?: WeaponAudioConfig;
}

export interface FactionVisualDefaults {
  emissive: [number, number, number];
  tailWidthRatio?: number;
}

export interface WeaponsManifest {
  defaults: Partial<Record<WeaponDelivery, string>>;
  weapons: Record<string, WeaponDefinitionEntry>;
  visualProfiles: Record<string, ProjectileVisualConfig>;
  factionVisualDefaults?: Partial<Record<WeaponFaction, FactionVisualDefaults>>;
}

const BEHAVIOR_HINT_MAP: Record<string, ProjectileBehavior> = {
  bomb: 'bomb',
  rocket: 'rocket',
  missile: 'missile_homing',
  torpedo: 'missile_homing',
  harpoon: 'bolt',
  projectile: 'bolt',
};

export async function loadWeaponsManifest(url: string): Promise<WeaponsManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load weapons manifest: ${url}`);
  return (await res.json()) as WeaponsManifest;
}

export function resolveProjectileVisual(
  manifest: WeaponsManifest,
  profileId: string,
  weaponFaction?: WeaponFaction,
): ProjectileVisualConfig | null {
  const profile = manifest.visualProfiles[profileId];
  if (!profile) return null;

  const factionDefaults =
    weaponFaction && manifest.factionVisualDefaults
      ? manifest.factionVisualDefaults[weaponFaction]
      : undefined;

  return {
    ...profile,
    emissive: profile.emissive ?? factionDefaults?.emissive ?? [1, 1, 1],
    tailWidthRatio:
      profile.tailWidthRatio ?? factionDefaults?.tailWidthRatio,
  };
}

export function weaponIdExists(
  manifest: WeaponsManifest,
  shipWeapons: ResolvedShipWeaponsConfig,
  weaponId: string,
): boolean {
  return !!(manifest.weapons[weaponId] || shipWeapons.definitions[weaponId]);
}

export function resolveWeaponIdForMount(
  manifest: WeaponsManifest,
  shipWeapons: ResolvedShipWeaponsConfig,
  slotId: string,
  delivery: WeaponDelivery,
  behaviorHint: string | undefined,
): string | null {
  const explicit = shipWeapons.slotBindings[slotId];
  if (explicit && weaponIdExists(manifest, shipWeapons, explicit)) {
    const entry = manifest.weapons[explicit] ?? shipWeapons.definitions[explicit];
    const resolvedDelivery = entry?.delivery;
    if (!resolvedDelivery || resolvedDelivery === delivery) {
      return explicit;
    }
  }

  if (behaviorHint) {
    const mapped = BEHAVIOR_HINT_MAP[behaviorHint];
    if (mapped) {
      const byBehavior = Object.entries(manifest.weapons).find(
        ([, def]) => def.delivery === 'projectile' && def.behavior === mapped,
      );
      if (byBehavior) return byBehavior[0];
    }
  }

  const shipDefault = shipWeapons.defaults[delivery];
  if (shipDefault && weaponIdExists(manifest, shipWeapons, shipDefault)) {
    return shipDefault;
  }

  const globalDefault = manifest.defaults[delivery];
  if (globalDefault && manifest.weapons[globalDefault]) {
    return globalDefault;
  }

  return null;
}

function stripDefinitionMeta(
  patch: ShipWeaponDefinitionPatch,
): Partial<WeaponDefinitionEntry> {
  const { extends: _extends, ammo: _ammo, ...rest } = patch;
  return rest as Partial<WeaponDefinitionEntry>;
}

function isCompleteShipWeaponDefinition(
  patch: ShipWeaponDefinitionPatch,
): patch is WeaponDefinitionEntry {
  return !!(
    patch.delivery &&
    patch.behavior &&
    patch.fireGroup &&
    patch.cooldownSec !== undefined &&
    patch.damage !== undefined &&
    patch.visualProfile &&
    patch.projectile?.speed !== undefined &&
    patch.projectile?.maxRange !== undefined &&
    patch.projectile?.hitRadius !== undefined
  );
}

function mergeWeaponDefinitionEntry(
  base: WeaponDefinitionEntry,
  ...patches: (Partial<WeaponDefinitionEntry> | undefined)[]
): WeaponDefinitionEntry {
  let result: WeaponDefinitionEntry = {
    ...base,
    projectile: { ...base.projectile },
    homing: base.homing ? { ...base.homing } : undefined,
    audio: base.audio ? { ...base.audio } : undefined,
  };

  for (const patch of patches) {
    if (!patch) continue;
    const { projectile, homing, audio, ...scalar } = patch;
    result = {
      ...result,
      ...scalar,
      projectile: projectile
        ? { ...result.projectile, ...projectile }
        : result.projectile,
      homing: homing ? { ...(result.homing ?? homing), ...homing } : result.homing,
      audio: audio ? { ...(result.audio ?? audio), ...audio } : result.audio,
    };
  }

  return result;
}

export function resolveWeaponDefinitionEntry(
  manifest: WeaponsManifest,
  weaponId: string,
  shipWeapons: ResolvedShipWeaponsConfig,
  slotOverride?: ShipWeaponDefinitionPatch,
  visited = new Set<string>(),
): WeaponDefinitionEntry | null {
  if (visited.has(weaponId)) return null;
  visited.add(weaponId);

  const shipDef = shipWeapons.definitions[weaponId];
  const extendsId = shipDef?.extends;

  let base: WeaponDefinitionEntry | null = null;

  if (extendsId) {
    base = resolveWeaponDefinitionEntry(
      manifest,
      extendsId,
      shipWeapons,
      undefined,
      visited,
    );
  } else if (manifest.weapons[weaponId]) {
    base = manifest.weapons[weaponId];
  } else if (shipDef && isCompleteShipWeaponDefinition(shipDef)) {
    return mergeWeaponDefinitionEntry(
      shipDef,
      slotOverride ? stripDefinitionMeta(slotOverride) : undefined,
    );
  }

  if (!base) return null;

  return mergeWeaponDefinitionEntry(
    base,
    shipDef ? stripDefinitionMeta(shipDef) : undefined,
    slotOverride ? stripDefinitionMeta(slotOverride) : undefined,
  );
}
