import type { MissionNavigationConfig } from '../ai/navigation/nav-types';

export interface MissionWaveEnemy {
  shipId: string;
  spawn: [number, number, number];
  behavior: 'attack' | 'chase' | 'flank';
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
  meteors?: {
    prefabId: string;
    count: number;
    seed: number;
    spawnRegion: {
      type: 'sphereShell';
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
  stub?: boolean;
  stubMessage?: string;
}

export type MissionEndState = 'playing' | 'won' | 'lost';

export const MissionEndStates = {
  Playing: 'playing',
  Won: 'won',
  Lost: 'lost',
} as const satisfies Record<string, MissionEndState>;
