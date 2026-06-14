import type {
  DetectedWeaponMount,
  ShipManifestEntry,
  ShipWeaponDefinitionPatch,
} from '@rogue-leader/engine';
import type {
  WeaponsManifest,
  WeaponDefinitionEntry,
} from '../../data/config/weapons-manifest';
import {
  resolveProjectileVisual,
  resolveWeaponDefinitionEntry,
  resolveWeaponIdForMount,
} from '../../data/config/weapons-manifest';
import { resolveShipWeaponsConfig } from '../../data/config/ship-weapons-config';
import type { ResolvedWeaponDefinition } from './weapon-definition';
import type { ProjectileConfig } from '../projectiles/projectile-config';

function toResolvedWeaponDefinition(
  manifest: WeaponsManifest,
  weaponId: string,
  entry: WeaponDefinitionEntry,
): ResolvedWeaponDefinition | null {
  const visual = resolveProjectileVisual(
    manifest,
    entry.visualProfile,
    entry.faction,
  );
  if (!visual) return null;

  const projectile: ProjectileConfig = {
    speed: entry.projectile.speed,
    maxRange: entry.projectile.maxRange,
    hitRadius: entry.projectile.hitRadius,
    visual,
    behavior: entry.behavior,
    homing: entry.homing,
  };

  return {
    id: weaponId,
    delivery: entry.delivery,
    behavior: entry.behavior,
    faction: entry.faction,
    fireGroup: entry.fireGroup,
    cooldownSec: entry.cooldownSec,
    damage: entry.damage,
    projectile,
    homing: entry.homing,
    audio: entry.audio,
  };
}

export function resolveWeaponDefinition(
  manifest: WeaponsManifest,
  weaponId: string,
  shipWeapons: ReturnType<typeof resolveShipWeaponsConfig>,
  slotOverride?: ShipWeaponDefinitionPatch,
): ResolvedWeaponDefinition | null {
  const entry = resolveWeaponDefinitionEntry(
    manifest,
    weaponId,
    shipWeapons,
    slotOverride,
  );
  if (!entry) return null;
  return toResolvedWeaponDefinition(manifest, weaponId, entry);
}

export interface MountWeaponBinding {
  mount: DetectedWeaponMount;
  definition: ResolvedWeaponDefinition;
}

export function createMountWeaponBindings(
  manifest: WeaponsManifest,
  shipEntry: ShipManifestEntry,
  mounts: DetectedWeaponMount[],
): MountWeaponBinding[] {
  const shipWeapons = resolveShipWeaponsConfig(shipEntry);
  const result: MountWeaponBinding[] = [];

  for (const mount of mounts) {
    const weaponId = resolveWeaponIdForMount(
      manifest,
      shipWeapons,
      mount.slotId,
      mount.delivery,
      mount.behaviorHint,
    );
    if (!weaponId) continue;

    const def = resolveWeaponDefinition(
      manifest,
      weaponId,
      shipWeapons,
      shipWeapons.slotOverrides[mount.slotId],
    );
    if (!def) continue;

    result.push({ mount, definition: def });
  }

  return result;
}
