import { MissionIds } from "../config/constants";
import type { MissionConfig } from "./mission-types";
import asteroidFieldSpace from "./configs/asteroid-field-space.json";
import mission02 from "./configs/mission-02-hoth-surface.json";
import mission03 from "./configs/mission-03-tatooine.json";

const MISSIONS: Record<string, MissionConfig> = {
  [MissionIds.AsteroidFieldSpace]:
    asteroidFieldSpace as unknown as MissionConfig,
  [MissionIds.HothSurface]: mission02 as unknown as MissionConfig,
  [MissionIds.Tatooine]: mission03 as unknown as MissionConfig,
};

export function getMissionList(): {
  id: string;
  displayName: string;
  stub: boolean;
  stubMessage?: string;
}[] {
  return Object.values(MISSIONS).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    stub: !!m.stub,
    stubMessage: m.stubMessage,
  }));
}

export function getMissionConfig(id: string): MissionConfig | undefined {
  return MISSIONS[id];
}

export function requireMissionConfig(id: string): MissionConfig {
  const config = MISSIONS[id];
  if (!config) throw new Error(`Unknown mission: ${id}`);
  if (config.stub) {
    throw new Error(config.stubMessage ?? "Mission not available");
  }
  return config;
}
