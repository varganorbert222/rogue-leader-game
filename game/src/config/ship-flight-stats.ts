import type { ShipManifestEntry } from '@rogue-leader/engine';
import {
  DEFAULT_BOOST_MULTIPLIER,
  DEFAULT_MAX_SPEED,
  MIN_FLIGHT_SPEED,
} from '../flight/flight-constants';
import {
  ROGUE_PITCH_RATE,
  ROGUE_ROLL_RATE,
  ROGUE_YAW_RATE,
} from '../flight/rogue-flight-controls';

export interface ShipFlightStatsConfig {
  maxSpeed?: number;
  minSpeed?: number;
  boostMultiplier?: number;
  pitchRate?: number;
  yawRate?: number;
  rollRate?: number;
  thrustRate?: number;
  brakeRate?: number;
  cruiseSpeed?: number;
}

export interface ResolvedShipFlightStats {
  maxSpeed: number;
  minSpeed: number;
  boostMultiplier: number;
  pitchRate: number;
  yawRate: number;
  rollRate: number;
  thrustRate: number;
  brakeRate: number;
  cruiseSpeed: number;
}

const DEFAULTS: ResolvedShipFlightStats = {
  maxSpeed: DEFAULT_MAX_SPEED,
  minSpeed: MIN_FLIGHT_SPEED,
  boostMultiplier: DEFAULT_BOOST_MULTIPLIER,
  pitchRate: ROGUE_PITCH_RATE,
  yawRate: ROGUE_YAW_RATE,
  rollRate: ROGUE_ROLL_RATE,
  thrustRate: 35,
  brakeRate: 45,
  cruiseSpeed: 55,
};

export function resolveShipFlightStats(
  entry?: ShipManifestEntry,
  globalDefaults?: ShipFlightStatsConfig | ResolvedShipFlightStats
): ResolvedShipFlightStats {
  const partial = { ...globalDefaults, ...entry?.flight } as ShipFlightStatsConfig;
  return {
    maxSpeed: partial.maxSpeed ?? DEFAULTS.maxSpeed,
    minSpeed: partial.minSpeed ?? DEFAULTS.minSpeed,
    boostMultiplier: partial.boostMultiplier ?? DEFAULTS.boostMultiplier,
    pitchRate: partial.pitchRate ?? DEFAULTS.pitchRate,
    yawRate: partial.yawRate ?? DEFAULTS.yawRate,
    rollRate: partial.rollRate ?? DEFAULTS.rollRate,
    thrustRate: partial.thrustRate ?? DEFAULTS.thrustRate,
    brakeRate: partial.brakeRate ?? DEFAULTS.brakeRate,
    cruiseSpeed: partial.cruiseSpeed ?? partial.maxSpeed ?? DEFAULTS.cruiseSpeed,
  };
}
