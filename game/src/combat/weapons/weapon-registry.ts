import type { ShipManifestEntry } from '@rogue-leader/engine';
import type { DetectedWeaponMount } from '@rogue-leader/engine';
import type { WeaponsManifest } from '../../data/config/weapons-manifest';
import { resolveWeaponIdForMount } from '../../data/config/weapons-manifest';
import type { ResolvedWeaponDefinition } from './weapon-definition';
import type { ProjectileConfig } from '../projectiles/projectile-config';

export function resolveWeaponDefinition(
  manifest: WeaponsManifest,
  weaponId: string
): ResolvedWeaponDefinition | null {
  const entry = manifest.weapons[weaponId];
  if (!entry) return null;

  const visual = manifest.visualProfiles[entry.visualProfile];
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

export function bindMountsToWeapons(
  manifest: WeaponsManifest,
  shipEntry: ShipManifestEntry,
  mounts: DetectedWeaponMount[]
): ResolvedWeaponDefinition[] {
  const bindings = shipEntry.anchors?.weapons;
  const defaults = shipEntry.defaultWeapons;
  const resolved: ResolvedWeaponDefinition[] = [];
  const seen = new Set<string>();

  for (const mount of mounts) {
    const weaponId = resolveWeaponIdForMount(
      manifest,
      defaults,
      mount.slotId,
      mount.delivery,
      mount.behaviorHint,
      bindings
    );
    if (!weaponId) continue;

    const key = `${weaponId}@${mount.slotId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const def = resolveWeaponDefinition(manifest, weaponId);
    if (def) resolved.push(def);
  }

  return resolved;
}

export interface MountWeaponBinding {
  mount: DetectedWeaponMount;
  definition: ResolvedWeaponDefinition;
}

export function createMountWeaponBindings(
  manifest: WeaponsManifest,
  shipEntry: ShipManifestEntry,
  mounts: DetectedWeaponMount[]
): MountWeaponBinding[] {
  const bindings = shipEntry.anchors?.weapons;
  const defaults = shipEntry.defaultWeapons;
  const result: MountWeaponBinding[] = [];

  for (const mount of mounts) {
    const weaponId = resolveWeaponIdForMount(
      manifest,
      defaults,
      mount.slotId,
      mount.delivery,
      mount.behaviorHint,
      bindings
    );
    if (!weaponId) continue;

    const def = resolveWeaponDefinition(manifest, weaponId);
    if (!def) continue;

    result.push({ mount, definition: def });
  }

  return result;
}
