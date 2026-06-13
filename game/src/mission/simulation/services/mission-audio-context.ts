import { Vector3 } from '@babylonjs/core';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { NpcBehaviorConfig } from '../../../data/config/npc-behavior-config';
import { Role } from '../../../ecs/components/role-tag';
import type { EntityId } from '../../../ecs/entity-id';
import {
  getEngineSpeedRatio,
  getShipPosition,
  getShipVelocity,
} from '../../../ecs/queries/ship-queries';
import type { World } from '../../../ecs/world';
import type {
  GameAudioUpdateContext,
  ShipEngineAudioSource,
} from '../../../audio/game-audio-bridge';
import type { PlayerInput } from '../../../player/input/player-input';

export function buildNpcEngineSources(world: World): ShipEngineAudioSource[] {
  const sources: ShipEngineAudioSource[] = [];
  for (const npcId of world.queryByRole(Role.Npc)) {
    const health = world.get(npcId, 'health');
    const shipIdentity = world.get(npcId, 'shipIdentity');
    if (!health || health.isDead() || !shipIdentity || !world.has(npcId, 'flight')) {
      continue;
    }
    sources.push({
      id: npcId,
      shipId: shipIdentity.shipId,
      position: getShipPosition(world, npcId).clone(),
      velocity: getShipVelocity(world, npcId).clone(),
      speedRatio: getEngineSpeedRatio(world, npcId),
    });
  }
  return sources;
}

export function buildMissionAudioContext(params: {
  world: World;
  playerId: EntityId;
  input: PlayerInput;
  dt: number;
  camera: Camera;
  npcBehaviorConfig: NpcBehaviorConfig;
  prevListenerPosition: Vector3 | null;
}): {
  context: GameAudioUpdateContext;
  prevListenerPosition: Vector3;
} {
  const { world, playerId } = params;
  const hasPlayerShip = world.has(playerId, 'flight');
  const playerPos = hasPlayerShip
    ? getShipPosition(world, playerId)
    : Vector3.Zero();
  const listenerPos = params.camera.position.clone();
  let listenerVelocity = hasPlayerShip
    ? getShipVelocity(world, playerId).clone()
    : Vector3.Zero();

  if (params.prevListenerPosition && params.dt > 0) {
    listenerVelocity = listenerPos
      .subtract(params.prevListenerPosition)
      .scale(1 / params.dt);
  }

  const radar = params.npcBehaviorConfig.radarRadius;
  const attack = params.npcBehaviorConfig.attackEnterRange;
  let enemiesInRadar = 0;
  let enemiesInAttackRange = 0;

  for (const npcId of world.queryByRole(Role.Npc)) {
    const health = world.get(npcId, 'health');
    if (!health || health.isDead() || !world.has(npcId, 'flight')) continue;
    const dist = Vector3.Distance(playerPos, getShipPosition(world, npcId));
    if (dist <= radar) enemiesInRadar++;
    if (dist <= attack) enemiesInAttackRange++;
  }

  return {
    prevListenerPosition: listenerPos.clone(),
    context: {
      enemyCount: world.getNpcCount(),
      enemiesInRadar,
      enemiesInAttackRange,
      playerFiring:
        params.input.combat.fire || params.input.combat.fireSecondaryPressed,
      playerThrottle: params.input.vehicle.throttle,
      listenerPosition: listenerPos,
      listenerVelocity,
      playerPosition: playerPos.clone(),
      playerVelocity: hasPlayerShip
        ? getShipVelocity(world, playerId).clone()
        : Vector3.Zero(),
      playerSpeedRatio: hasPlayerShip
        ? getEngineSpeedRatio(world, playerId)
        : 0,
      npcEngines: buildNpcEngineSources(world),
    },
  };
}
