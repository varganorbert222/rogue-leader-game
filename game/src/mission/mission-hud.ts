import { Quaternion, type Scene } from "@babylonjs/core";
import { AmmoIds } from "../data/constants";
import type { PlayerActor } from "../actors/player-actor";
import {
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
} from "../flight/flight-constants";
import {
  projectWorldToScreen,
  type HudScreenPoint,
} from "../flight/screen-project";
import { getShipForward } from "../flight/ship-forward";
import type { CombatSystem } from "../weapons/combat-system";
import { hudCurrentWave, hudTotalWaves } from "./mission-waves";
import type { MissionConfig } from "./mission-types";

export interface MissionLoadState {
  loading: boolean;
  message: string;
}

export interface MissionHudState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
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
  player?: PlayerActor;
  combat: CombatSystem;
  wavesSpawned: number;
  config?: MissionConfig;
  npcCount: number;
}): MissionHudState {
  const hidden: HudScreenPoint = { xPct: 50, yPct: 50, visible: false };
  let reticleInner = hidden;
  let reticleOuter = hidden;

  const { player, scene } = params;
  if (player) {
    const shipPos = player.vehicle.root.getAbsolutePosition();
    const fwd = getShipForward(
      player.vehicle.root.rotationQuaternion ?? Quaternion.Identity(),
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
    health: player?.health.health ?? 0,
    maxHealth: player?.health.maxHealth ?? 100,
    shield: player?.health.shield ?? 0,
    maxShield: player?.health.maxShield ?? 50,
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
    targetLock: player?.targeting.getActiveTarget()?.screenPoint ?? null,
  };
}
