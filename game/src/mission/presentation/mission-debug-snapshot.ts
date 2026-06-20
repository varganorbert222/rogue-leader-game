import type { NpcBehaviorConfig } from '../../config/loaders/npc-behavior-config';

import type { DebugPreferences } from '../../debug/debug-preferences';

import type { GameDebugFrame } from '../../debug/game-debug-overlay';

import {

  needsAsteroidDebugData,

  needsColliderDebugData,

  needsNavDebugData,

  needsNpcDebugData,

  needsPlayerAimDebugData,

  needsProjectileDebugData,

  needsVehicleDebugData,

  needsZoneDebugData,

} from '../../debug/debug-overlay-utils';

import type { MissionNavigation } from '../../ai/navigation/mission-navigation';

import type { CombatSystem } from '../../combat/systems/combat-system';

import { Role } from '../../ecs/components/role-tag';

import type { EntityId } from '../../ecs/entity-id';

import { getShipPosition } from '../../ecs/queries/ship-queries';

import type { World } from '../../ecs/world';

import { getNpcSteeringDebug } from '../../simulation/systems/npc-system';



export interface MissionDebugSnapshotContext {

  world: World;

  playerId: EntityId;

  prefs: DebugPreferences;

  missionNavigation: MissionNavigation;

  npcBehaviorConfig: NpcBehaviorConfig;

  combat: CombatSystem;

}



export function collectMissionDebugFrame(

  ctx: MissionDebugSnapshotContext,

): GameDebugFrame {

  const { world, playerId, prefs } = ctx;



  const vehicles = [];

  if (needsVehicleDebugData(prefs)) {

    for (const id of world.query('flight', 'role', 'shipIdentity', 'collider')) {

      const shipIdentity = world.get(id, 'shipIdentity')!;

      const collider = world.get(id, 'collider')!;

      const role = world.get(id, 'role');

      vehicles.push({

        id,

        position: getShipPosition(world, id).clone(),

        radius: collider.radius,

        label: shipIdentity.shipId,

        isPlayer: role === Role.Player,

      });

    }

  }



  const npcSnapshots = needsNpcDebugData(prefs)

    ? world

        .queryByRole(Role.Npc)

        .map((npcId) => {

          const steering = getNpcSteeringDebug(world, npcId);

          const npcSteering = world.get(npcId, 'npcSteering');

          if (!steering || !world.has(npcId, 'flight')) return null;

          return {

            id: npcId,

            flockId: npcSteering?.flockId ?? '',

            position: getShipPosition(world, npcId).clone(),

            state: steering.state,

            steering,

            radarRadius: ctx.npcBehaviorConfig.radarRadius,

          };

        })

        .filter((entry): entry is NonNullable<typeof entry> => entry != null)

    : [];



  const playerTargeting = world.get(playerId, 'targeting');



  return {

    playerAim: needsPlayerAimDebugData(prefs)

      ? (playerTargeting?.lastAimDebug ?? undefined)

      : undefined,

    paths: needsNavDebugData(prefs)

      ? ctx.missionNavigation.listPathPolylines()

      : [],

    zones: needsZoneDebugData(prefs)

      ? ctx.missionNavigation.listZones()

      : [],

    npcs: npcSnapshots,

    vehicles,

    projectiles: needsProjectileDebugData(prefs)

      ? ctx.combat.projectiles.getDebugSnapshots()

      : [],

    asteroids: needsAsteroidDebugData(prefs)

      ? world.queryByRole(Role.Asteroid).map((id) => {

          const body = world.get(id, 'asteroidBody')!;

          return {

            id,

            position: body.root.position.clone(),

            radius: body.colliderRadius,

            usesMeshCollider: body.usesMeshCollider,

          };

        })

      : [],

    colliders: needsColliderDebugData(prefs)

      ? collectColliderDebugSnapshots(world)

      : [],

  };

}



function collectColliderDebugSnapshots(world: World) {

  const colliders = [];



  for (const id of world.query('flight', 'role', 'collider')) {

    const collider = world.get(id, 'collider')!;

    if (!collider.meshes.length) continue;

    colliders.push({

      ownerId: id,

      meshes: collider.meshes,

      isPlayer: world.get(id, 'role') === Role.Player,

      kind: 'ship' as const,

    });

  }



  for (const id of world.queryByRole(Role.Asteroid)) {

    const body = world.get(id, 'asteroidBody');

    if (!body?.colliderMeshes.length) continue;

    colliders.push({

      ownerId: id,

      meshes: body.colliderMeshes,

      isPlayer: false,

      kind: 'asteroid' as const,

    });

  }



  return colliders;

}

