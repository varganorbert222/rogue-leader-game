import type { ProjectileConfig } from './projectile-config';

export type WeaponKind = 'projectile' | 'missile' | 'harpoon';

export interface ProjectileWeaponDefinition {
  id: string;
  kind: 'projectile';
  /** Matches mount weaponType (e.g. laser). */
  mountType: string;
  cooldownSec: number;
  damage: number;
  projectile: ProjectileConfig;
}

export interface StubWeaponDefinition {
  id: string;
  kind: 'missile' | 'harpoon';
  mountType: string;
}

export type WeaponDefinition = ProjectileWeaponDefinition | StubWeaponDefinition;

export function isProjectileWeapon(
  def: WeaponDefinition
): def is ProjectileWeaponDefinition {
  return def.kind === 'projectile';
}
