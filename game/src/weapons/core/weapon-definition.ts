import type {
  WeaponAudioConfig,
  WeaponBehavior,
  WeaponDelivery,
  WeaponFireGroup,
  WeaponFaction,
  WeaponHomingConfig,
} from '../../config/weapons-manifest';
import type { ProjectileConfig } from './projectile-config';

export type { WeaponDelivery, WeaponBehavior, WeaponFireGroup, WeaponFaction };

export interface ResolvedWeaponDefinition {
  id: string;
  delivery: WeaponDelivery;
  behavior: WeaponBehavior;
  faction?: WeaponFaction;
  fireGroup: WeaponFireGroup;
  cooldownSec: number;
  damage: number;
  projectile: ProjectileConfig;
  homing?: WeaponHomingConfig;
  audio?: WeaponAudioConfig;
}

/** @deprecated Use ResolvedWeaponDefinition + weapons manifest. */
export interface ProjectileWeaponDefinition {
  id: string;
  kind: 'projectile';
  mountType: string;
  cooldownSec: number;
  damage: number;
  projectile: ProjectileConfig;
}

/** @deprecated Missiles use projectile delivery + behavior in manifest. */
export interface StubWeaponDefinition {
  id: string;
  kind: 'missile' | 'harpoon';
  mountType: string;
}

/** @deprecated */
export type WeaponDefinition = ProjectileWeaponDefinition | StubWeaponDefinition;

/** @deprecated */
export function isProjectileWeapon(
  def: WeaponDefinition
): def is ProjectileWeaponDefinition {
  return def.kind === 'projectile';
}
