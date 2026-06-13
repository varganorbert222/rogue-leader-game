import { Vector3, type Scene } from '@babylonjs/core';
import { computeFlockCenter, resolveFlockOverlap } from '../../ai/boid-forces';
import {
  BehaviorNpcInput,
  type NpcSteeringDebugInfo,
} from '../../ai/behavior-npc-input';
import { updateWeaponAimForObserver } from '../../combat/targeting/weapon-aim-controller';
import type { CombatConfig } from '../../data/config/combat-config';
import type { NpcBehaviorConfig } from '../../data/config/npc-behavior-config';
import { Role } from '../components/role-tag';
import { entityToTargetEntity } from '../queries/combat-queries';
import {
  applyShipFlightInput,
  getShipCruiseSpeed,
  getShipPosition,
  getShipRotation,
  getShipSpeed,
  getShipVelocity,
} from '../queries/ship-queries';
import type { World } from '../world';
import type { EntityId } from '../entity-id';
import { getShipForward } from '../../flight/ship-forward';
import type { CombatSystem } from '../../combat/systems/combat-system';

export interface NpcSystemContext {
  scene: Scene;
  world: World;
  combat: CombatSystem;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
}

export function getNpcSteeringDebug(
  world: World,
  id: EntityId,
): NpcSteeringDebugInfo | null {
  const steering = world.get(id, 'npcSteering');
  if (steering?.input instanceof BehaviorNpcInput) {
    return steering.input.getDebugInfo();
  }
  return null;
}

export function runNpcSystem(
  ctx: NpcSystemContext,
  dt: number,
  playerId: EntityId,
  boundary?: { center: Vector3; radius: number },
): void {
  const { world } = ctx;
  if (!world.has(playerId, 'flight')) return;

  const playerPos = getShipPosition(world, playerId);
  const playerVel = getShipVelocity(world, playerId);
  const playerTarget = entityToTargetEntity(world, playerId);

  const npcIds = world.queryByRole(Role.Npc);
  const flockMembers = new Map<string, EntityId[]>();
  for (const npcId of npcIds) {
    const steering = world.get(npcId, 'npcSteering');
    if (!steering) continue;
    const members = flockMembers.get(steering.flockId) ?? [];
    members.push(npcId);
    flockMembers.set(steering.flockId, members);
  }

  const flockCenters = new Map<string, Vector3>();
  for (const [flockId, members] of flockMembers) {
    flockCenters.set(
      flockId,
      computeFlockCenter(members.map((id) => getShipPosition(world, id))),
    );
  }

  for (const npcId of npcIds) {
    const steering = world.get(npcId, 'npcSteering');
    const faction = world.get(npcId, 'faction');
    const targeting = world.get(npcId, 'targeting');
    const weapons = world.get(npcId, 'weapons');
    const shipIdentity = world.get(npcId, 'shipIdentity');
    const collider = world.get(npcId, 'collider');
    if (
      !steering ||
      faction === undefined ||
      !targeting ||
      !weapons ||
      !shipIdentity ||
      !collider
    ) {
      continue;
    }

    const npcPos = getShipPosition(world, npcId);
    const flock = flockMembers.get(steering.flockId) ?? [];
    const flockMates = flock
      .filter((mateId) => mateId !== npcId)
      .map((mateId) => {
        const mateCollider = world.get(mateId, 'collider')!;
        return {
          id: mateId,
          position: getShipPosition(world, mateId),
          velocity: getShipVelocity(world, mateId),
          radius: mateCollider.radius,
        };
      });

    const result = steering.input.update(dt, {
      playerPosition: playerPos,
      flockMates,
      flockCenter: flockCenters.get(steering.flockId) ?? npcPos,
      vehiclePosition: npcPos,
      vehicleRotation: getShipRotation(world, npcId),
      vehicleSpeed: getShipSpeed(world, npcId),
      cruiseSpeed: getShipCruiseSpeed(world, npcId),
      vehicleColliderRadius: collider.radius,
    });

    applyShipFlightInput(world, npcId, dt, result.vehicle, boundary);
    resolveFlockOverlap(npcPos, collider.radius, flockMates);

    const enemyForward = getShipForward(getShipRotation(world, npcId));
    if (playerTarget) {
      updateWeaponAimForObserver({
        scene: ctx.scene,
        combat: ctx.combat,
        weapons: weapons.system,
        observerId: npcId,
        observerFaction: faction,
        observerPos: npcPos,
        observerVel: getShipVelocity(world, npcId),
        aimAxis: enemyForward,
        candidates: [playerTarget],
        targeting: ctx.combatConfig.targeting,
        radarRadius: ctx.npcBehaviorConfig.radarRadius,
        dt,
        mode: 'radar',
        targetingSystem: targeting.system,
      });
    }

    if (result.wantsFire) {
      ctx.combat.tryFireAtTarget(
        weapons.system,
        shipIdentity.combatTeam,
        faction,
        npcId,
        playerPos,
        playerVel,
        getShipVelocity(world, npcId),
        ctx.combatConfig.targeting,
        ctx.npcBehaviorConfig.fireRange,
      );
    }
  }
}
