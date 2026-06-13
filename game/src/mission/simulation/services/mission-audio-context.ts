import { Vector3 } from '@babylonjs/core';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { NpcBehaviorConfig } from '../../../data/config/npc-behavior-config';
import type { PlayerActor } from '../../../actors/player-actor';
import type { ActorRegistry } from '../../../actors/actor-registry';
import type {
  GameAudioUpdateContext,
  ShipEngineAudioSource,
} from '../../../audio/game-audio-bridge';
import type { PlayerInput } from '../../../player/input/player-input';

export function buildNpcEngineSources(
  actors: ActorRegistry,
): ShipEngineAudioSource[] {
  const sources: ShipEngineAudioSource[] = [];
  for (const npc of actors.npcActors) {
    if (npc.health.isDead()) continue;
    sources.push({
      id: npc.id,
      shipId: npc.vehicle.shipId,
      position: npc.vehicle.position.clone(),
      velocity: npc.vehicle.velocity.clone(),
      speedRatio: npc.vehicle.getEngineSpeedRatio(),
    });
  }
  return sources;
}

export function buildMissionAudioContext(params: {
  actors: ActorRegistry;
  player: PlayerActor;
  input: PlayerInput;
  dt: number;
  camera: Camera;
  npcBehaviorConfig: NpcBehaviorConfig;
  prevListenerPosition: Vector3 | null;
}): {
  context: GameAudioUpdateContext;
  prevListenerPosition: Vector3;
} {
  const playerPos = params.player.vehicle.position;
  const listenerPos = params.camera.position.clone();
  let listenerVelocity = params.player.vehicle.velocity.clone();

  if (params.prevListenerPosition && params.dt > 0) {
    listenerVelocity = listenerPos
      .subtract(params.prevListenerPosition)
      .scale(1 / params.dt);
  }

  const radar = params.npcBehaviorConfig.radarRadius;
  const attack = params.npcBehaviorConfig.attackEnterRange;
  let enemiesInRadar = 0;
  let enemiesInAttackRange = 0;

  for (const npc of params.actors.npcActors) {
    if (npc.health.isDead()) continue;
    const dist = Vector3.Distance(playerPos, npc.vehicle.position);
    if (dist <= radar) enemiesInRadar++;
    if (dist <= attack) enemiesInAttackRange++;
  }

  return {
    prevListenerPosition: listenerPos.clone(),
    context: {
      enemyCount: params.actors.getNpcCount(),
      enemiesInRadar,
      enemiesInAttackRange,
      playerFiring:
        params.input.combat.fire || params.input.combat.fireSecondaryPressed,
      playerThrottle: params.input.vehicle.throttle,
      listenerPosition: listenerPos,
      listenerVelocity,
      playerPosition: playerPos.clone(),
      playerVelocity: params.player.vehicle.velocity.clone(),
      playerSpeedRatio: params.player.vehicle.getEngineSpeedRatio(),
      npcEngines: buildNpcEngineSources(params.actors),
    },
  };
}
