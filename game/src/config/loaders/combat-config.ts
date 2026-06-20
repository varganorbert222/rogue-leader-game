import type { ShipFlightStatsConfig } from './ship-flight-stats';

export interface RadarConfig {
  radius: number;
}

export interface TargetingConfig {
  autoAimRange: number;
  targetConeHalfAngleDeg: number;
  targetScreenRadiusPct: number;
  convergenceDistance: number;
  maxDeflectionDeg: number;
  weaponAimSpeedDeg: number;
  screenDistanceWeight: number;
  worldDistanceWeight: number;
}

export interface CombatConfig {
  targeting: TargetingConfig;
  radar: RadarConfig;
  defaults: {
    flight: ShipFlightStatsConfig;
  };
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  radar: {
    radius: 175,
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
