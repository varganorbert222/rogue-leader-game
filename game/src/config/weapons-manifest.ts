import type { EngineVfxProfile } from '@rogue-leader/engine';
import type { ProjectileVisualConfig } from '../weapons/core/projectile-config';

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

export interface WeaponsManifest {
  defaults: Partial<Record<WeaponDelivery, string>>;
  weapons: Record<string, WeaponDefinitionEntry>;
  visualProfiles: Record<string, ProjectileVisualConfig>;
  engineVfx: Record<string, EngineVfxProfile>;
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

export function resolveWeaponIdForMount(
  manifest: WeaponsManifest,
  shipDefaults: Partial<Record<WeaponDelivery, string>> | undefined,
  slotId: string,
  delivery: WeaponDelivery,
  behaviorHint: string | undefined,
  slotBindings: Record<string, string> | undefined
): string | null {
  const explicit = slotBindings?.[slotId];
  if (explicit && manifest.weapons[explicit]) {
    return explicit;
  }

  if (behaviorHint) {
    const mapped = BEHAVIOR_HINT_MAP[behaviorHint];
    if (mapped) {
      const byBehavior = Object.entries(manifest.weapons).find(
        ([, def]) => def.delivery === 'projectile' && def.behavior === mapped
      );
      if (byBehavior) return byBehavior[0];
    }
  }

  const shipDefault = shipDefaults?.[delivery];
  if (shipDefault && manifest.weapons[shipDefault]) {
    return shipDefault;
  }

  const globalDefault = manifest.defaults[delivery];
  if (globalDefault && manifest.weapons[globalDefault]) {
    return globalDefault;
  }

  return null;
}

export function resolveEngineVfxProfile(
  manifest: WeaponsManifest,
  slotId: string,
  engineBindings: Record<string, string> | undefined,
  faction?: WeaponFaction
): EngineVfxProfile | undefined {
  const profileId = engineBindings?.[slotId];
  if (profileId && manifest.engineVfx[profileId]) {
    return manifest.engineVfx[profileId];
  }

  if (faction === 'imperial' && manifest.engineVfx['imperial_ion_engine']) {
    return manifest.engineVfx['imperial_ion_engine'];
  }
  if (manifest.engineVfx['rebel_ion_engine']) {
    return manifest.engineVfx['rebel_ion_engine'];
  }

  return undefined;
}
