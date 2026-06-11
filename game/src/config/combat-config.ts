import type { ShipFlightStatsConfig } from './ship-flight-stats';

export interface TargetingConfig {
  autoAimRange: number;
  /** Max screen distance from reticle center (%) to acquire / keep a lock. */
  targetScreenRadiusPct: number;
  /** Distance along crosshair axis where wing mounts converge (m). */
  convergenceDistance: number;
  maxDeflectionDeg: number;
  /** Weapon gimbal rotation speed toward aim (deg/s). */
  weaponAimSpeedDeg: number;
  screenDistanceWeight: number;
  worldDistanceWeight: number;
}

export interface CombatConfig {
  targeting: TargetingConfig;
  defaults: {
    flight: ShipFlightStatsConfig;
  };
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  targeting: {
    autoAimRange: 500,
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
