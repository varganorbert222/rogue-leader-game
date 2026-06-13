import type { ProjectileBehavior, WeaponHomingConfig } from '../../data/config/weapons-manifest';

import type { ProjectileVisualConfig } from '@rogue-leader/engine';

export type { ProjectileVisualConfig };

export interface ProjectileConfig {
  speed: number;
  maxRange: number;
  hitRadius: number;
  visual: ProjectileVisualConfig;
  behavior?: ProjectileBehavior | string;
  homing?: WeaponHomingConfig;
}

export const PLAYER_LASER_PROJECTILE: ProjectileConfig = {
  speed: 420,
  maxRange: 280,
  hitRadius: 0.12,
  behavior: 'bolt',
  visual: {
    boltLength: 0.75,
    boltDiameter: 0.1,
    emissive: [0.2, 0.85, 1],
  },
};

export const ENEMY_LASER_PROJECTILE: ProjectileConfig = {
  speed: 360,
  maxRange: 220,
  hitRadius: 0.12,
  behavior: 'bolt',
  visual: {
    boltLength: 0.65,
    boltDiameter: 0.09,
    emissive: [1, 0.25, 0.15],
  },
};
