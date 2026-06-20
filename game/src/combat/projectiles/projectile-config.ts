import type { ProjectileBehavior, WeaponHomingConfig } from '../../config/loaders/weapons-manifest';

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
    length: 1.45,
    width: 0.2,
    tailWidthRatio: 0.12,
    emissive: [1, 0.42, 0.12],
  },
};

export const ENEMY_LASER_PROJECTILE: ProjectileConfig = {
  speed: 360,
  maxRange: 220,
  hitRadius: 0.12,
  behavior: 'bolt',
  visual: {
    length: 1.35,
    width: 0.18,
    tailWidthRatio: 0.12,
    emissive: [0.25, 0.95, 0.35],
  },
};
