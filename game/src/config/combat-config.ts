import type { ShipFlightStatsConfig } from './ship-flight-stats';

export interface RadarConfig {
  radius: number;
}

export interface TargetingConfig {
  autoAimRange: number;
  /** Half-angle (degrees) of the auto-aim cone around the crosshair axis. */
  targetConeHalfAngleDeg: number;
  /** @deprecated HUD hint only — cone angle governs lock. */
  targetScreenRadiusPct: number;
  /** Distance along crosshair axis where wing mounts converge (m). */
  convergenceDistance: number;
  maxDeflectionDeg: number;
  /** Weapon gimbal rotation speed toward aim (deg/s). */
  weaponAimSpeedDeg: number;
  screenDistanceWeight: number;
  worldDistanceWeight: number;
}

export interface PlayerAmmoConfig {
  /** weapon manifest id → starting magazine size (projectiles only). */
  magazines: Record<string, number>;
}

export interface CombatConfig {
  targeting: TargetingConfig;
  radar: RadarConfig;
  playerAmmo: PlayerAmmoConfig;
  defaults: {
    flight: ShipFlightStatsConfig;
  };
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  radar: {
    radius: 175,
  },
  playerAmmo: {
    magazines: {
      proton_torpedo: 8,
      concussion_rocket: 6,
      concussion_bomb: 4,
    },
  },
  targeting: {
    autoAimRange: 500,
    targetConeHalfAngleDeg: 6,
    targetScreenRadiusPct: 12,
    convergenceDistance: 1000,
    maxDeflectionDeg: 35,
    weaponAimSpeedDeg: 120,
    screenDistanceWeight: 1,
    worldDistanceWeight: 0.08,
  },
  defaults: {
    flight: {},
  },
};

export async function loadCombatConfig(url: string): Promise<CombatConfig> {
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_COMBAT_CONFIG;
    const data = (await res.json()) as Partial<CombatConfig>;
    return {
      radar: { ...DEFAULT_COMBAT_CONFIG.radar, ...data.radar },
      playerAmmo: {
        magazines: {
          ...DEFAULT_COMBAT_CONFIG.playerAmmo.magazines,
          ...data.playerAmmo?.magazines,
        },
      },
      targeting: { ...DEFAULT_COMBAT_CONFIG.targeting, ...data.targeting },
      defaults: {
        flight: { ...DEFAULT_COMBAT_CONFIG.defaults.flight, ...data.defaults?.flight },
      },
    };
  } catch {
    return DEFAULT_COMBAT_CONFIG;
  }
}

export { DEFAULT_COMBAT_CONFIG };
