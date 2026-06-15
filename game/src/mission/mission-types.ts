import type { MissionNavigationConfig } from "../ai/navigation/nav-types";
import type { MissionSpawnPolicy } from "./spawn/mission-spawn-policy";

export interface MissionWaveEnemy {
  shipId: string;
  spawn: [number, number, number];
  behavior: "attack" | "chase" | "flank";
}

export interface MissionWave {
  id: string;
  delaySec: number;
  trigger?: string;
  enemies: MissionWaveEnemy[];
}

export interface MissionConfig {
  id: string;
  displayName: string;
  skyboxId: string;
  /** Photodome skybox: 0-based texture index or filename/path fragment from manifest `textures`. */
  skyboxTexture?: number | string;
  musicId: string;
  /** Adaptive calm ↔ combat score set id from audio manifest. */
  musicSetId?: string;
  /** Scene physics — space missions disable gravity; planetary missions enable it. */
  environment?: {
    gravity?: boolean;
    gravityVector?: [number, number, number];
  };
  player: {
    shipId: string;
    spawn: [number, number, number];
    heading: [number, number, number];
  };
  playVolume: {
    center: [number, number, number];
    radius: number;
    softBoundary: boolean;
  };
  asteroids?: {
    prefabId: string;
    count: number;
    seed: number;
    spawnRegion: {
      type: "sphereShell";
      center: number[];
      innerRadius: number;
      outerRadius: number;
    };
    scaleRange: [number, number];
    damageOnImpact: number;
    slowTumble: boolean;
    maxAngularSpeed: number;
  };
  waves: MissionWave[];
  navigation?: MissionNavigationConfig;
  winCondition: { type: string };
  loseCondition: { type: string };
  introCinematicSec?: number;
  /** Optional spawn / respawn testing hooks. */
  spawnPolicy?: MissionSpawnPolicy;
  stub?: boolean;
  stubMessage?: string;
}

export type MissionEndState = "playing" | "won" | "lost";

export type MissionSessionPhase = "ship_select" | MissionEndState;

export const MissionEndStates = {
  Playing: "playing",
  Won: "won",
  Lost: "lost",
} as const satisfies Record<string, MissionEndState>;
