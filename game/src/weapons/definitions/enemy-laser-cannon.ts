import { ENEMY_LASER_PROJECTILE } from '../core/projectile-config';
import type { ProjectileWeaponDefinition } from '../core/weapon-definition';

export const ENEMY_LASER_CANNON: ProjectileWeaponDefinition = {
  id: 'enemy_laser_cannon',
  kind: 'projectile',
  mountType: 'laser',
  cooldownSec: 0.9,
  damage: 8,
  projectile: ENEMY_LASER_PROJECTILE,
};
