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

/** Minimal weapon metadata for future stub weapons (missile / harpoon placeholders). */
export interface StubWeaponDefinition {
  id: string;
  kind: 'missile' | 'harpoon';
  mountType: string;
}
