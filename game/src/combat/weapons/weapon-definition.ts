import type {
  WeaponAudioConfig,
  WeaponBehavior,
  WeaponDelivery,
  WeaponFireGroup,
  WeaponFaction,
  WeaponHomingConfig,
} from '../../data/config/weapons-manifest';
import type { ProjectileConfig } from '../projectiles/projectile-config';

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
