import { Quaternion, type Scene } from '@babylonjs/core';
import { AmmoIds } from '../../config/constants';
import {
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
} from '../../flight/flight-constants';
import {
  projectWorldToScreen,
  type HudScreenPoint,
} from '../../flight/screen-project';
import { getShipForward } from '../../flight/ship-forward';
import type { CombatSystem } from '../../combat/systems/combat-system';
import type { EntityId } from '../../ecs/entity-id';
import { getShipRoot } from '../../ecs/queries/ship-queries';
import type { World } from '../../ecs/world';
import {
  hudCurrentWave,
  hudTotalWaves,
} from '../../simulation/utils/wave-display';
import type { MissionConfig } from '../mission-types';

export interface MissionLoadState {
  loading: boolean;
  message: string;
}

export interface MissionHudState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  wave: number;
  totalWaves: number;
  enemiesRemaining: number;
  backend: string;
  laserReady: boolean;
  torpedoesRemaining: number;
  reticleInner: HudScreenPoint;
  reticleOuter: HudScreenPoint;
  targetLock: HudScreenPoint | null;
}

export function buildMissionHudState(params: {
  scene: Scene;
  backend: string;
  world: World;
  playerId?: EntityId;
  combat: CombatSystem;
  wavesSpawned: number;
  config?: MissionConfig;
  npcCount: number;
}): MissionHudState {
  const hidden: HudScreenPoint = { xPct: 50, yPct: 50, visible: false };
  let reticleInner = hidden;
  let reticleOuter = hidden;

  const { playerId, scene, world } = params;
  const playerHealth = playerId ? world.get(playerId, 'health') : undefined;
  const playerEnergy = playerId ? world.get(playerId, 'weaponEnergy') : undefined;
  const targeting = playerId ? world.get(playerId, 'targeting') : undefined;
  const hasPlayerShip = playerId ? world.has(playerId, 'flight') : false;

  if (playerId && hasPlayerShip) {
    const root = getShipRoot(world, playerId);
    const shipPos = root.getAbsolutePosition();
    const fwd = getShipForward(
      root.rotationQuaternion ?? Quaternion.Identity(),
    );
    reticleInner = projectWorldToScreen(
      scene,
      shipPos.add(fwd.scale(RETICLE_INNER_DISTANCE)),
    );
    reticleOuter = projectWorldToScreen(
      scene,
      shipPos.add(fwd.scale(RETICLE_OUTER_DISTANCE)),
    );
  }

  return {
    health: playerHealth?.health ?? 0,
    maxHealth: playerHealth?.maxHealth ?? 100,
    shield: playerHealth?.shield ?? 0,
    maxShield: playerHealth?.maxShield ?? 50,
    energy: playerEnergy?.energy ?? 0,
    maxEnergy: playerEnergy?.maxEnergy ?? 100,
    wave: hudCurrentWave(params.wavesSpawned, params.config?.waves),
    totalWaves: hudTotalWaves(params.config?.waves),
    enemiesRemaining: params.npcCount,
    backend: params.backend,
    laserReady: true,
    torpedoesRemaining: params.combat
      .getPlayerAmmo()
      .getCount(AmmoIds.ProtonTorpedo),
    reticleInner,
    reticleOuter,
    targetLock: targeting?.system.getActiveTarget()?.screenPoint ?? null,
  };
}
