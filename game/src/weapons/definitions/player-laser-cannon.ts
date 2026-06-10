import { PLAYER_LASER_PROJECTILE } from '../core/projectile-config';
import type { ProjectileWeaponDefinition } from '../core/weapon-definition';

export const PLAYER_LASER_CANNON: ProjectileWeaponDefinition = {
  id: 'player_laser_cannon',
  kind: 'projectile',
  mountType: 'laser',
  cooldownSec: 0.15,
  damage: 20,
  projectile: PLAYER_LASER_PROJECTILE,
};
