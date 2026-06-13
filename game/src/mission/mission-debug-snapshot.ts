import type { NpcBehaviorConfig } from "../data/config/npc-behavior-config";
import type { PlayerActor } from "../actors/player-actor";
import type { DebugPreferences } from "../debug/debug-preferences";
import type { GameDebugFrame } from "../debug/game-debug-overlay";
import {
  needsAsteroidDebugData,
  needsColliderDebugData,
  needsNavDebugData,
  needsNpcDebugData,
  needsPlayerAimDebugData,
  needsProjectileDebugData,
  needsVehicleDebugData,
  needsZoneDebugData,
} from "../debug/debug-overlay-utils";
import type { MissionNavigation } from "../ai/navigation/mission-navigation";
import type { AsteroidField } from "../hazards/asteroid-field";
import type { CombatSystem } from "../weapons/combat-system";
import type { ActorWorld } from "../actors/actor-world";

export interface MissionDebugSnapshotContext {
  world: ActorWorld;
  player: PlayerActor;
  prefs: DebugPreferences;
  missionNavigation: MissionNavigation;
  npcBehaviorConfig: NpcBehaviorConfig;
  combat: CombatSystem;
  asteroidField: AsteroidField;
}

export function collectMissionDebugFrame(
  ctx: MissionDebugSnapshotContext,
): GameDebugFrame {
  const { world, player, prefs } = ctx;
  const vehicles = [];
  if (needsVehicleDebugData(prefs)) {
    if (world.player) {
      vehicles.push({
        id: world.player.id,
        position: world.player.vehicle.position.clone(),
        radius: world.player.vehicle.colliderRadius,
        label: world.player.vehicle.shipId,
        isPlayer: true,
      });
    }
    for (const npc of world.npcActors) {
      vehicles.push({
        id: npc.id,
        position: npc.vehicle.position.clone(),
        radius: npc.vehicle.colliderRadius,
        label: npc.vehicle.shipId,
        isPlayer: false,
      });
    }
  }

  const npcSnapshots = needsNpcDebugData(prefs)
    ? world.npcActors
        .map((npc) => {
          const steering = npc.getSteeringDebug();
          if (!steering) return null;
          return {
            id: npc.id,
            flockId: npc.flockId,
            position: npc.vehicle.position.clone(),
            state: steering.state,
            steering,
            radarRadius: ctx.npcBehaviorConfig.radarRadius,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    : [];

  return {
    playerAim: needsPlayerAimDebugData(prefs)
      ? (player.lastAimDebug ?? undefined)
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
      ? ctx.asteroidField.asteroids.map((asteroid) => ({
          id: asteroid.id,
          position: asteroid.root.position.clone(),
          radius: asteroid.colliderRadius,
          usesMeshCollider: asteroid.usesMeshCollider,
        }))
      : [],
    colliders: needsColliderDebugData(prefs)
      ? collectColliderDebugSnapshots(ctx.world, ctx.asteroidField)
      : [],
  };
}

export function collectColliderDebugSnapshots(
  world: ActorWorld,
  asteroidField: AsteroidField,
) {
  const colliders = [];

  if (world.player?.vehicle.colliderMeshes.length) {
    colliders.push({
      ownerId: world.player.id,
      meshes: world.player.vehicle.colliderMeshes,
      isPlayer: true,
      kind: "ship" as const,
    });
  }

  for (const npc of world.npcActors) {
    if (!npc.vehicle.colliderMeshes.length) continue;
    colliders.push({
      ownerId: npc.id,
      meshes: npc.vehicle.colliderMeshes,
      isPlayer: false,
      kind: "ship" as const,
    });
  }

  for (const asteroid of asteroidField.asteroids) {
    if (!asteroid.colliderMeshes.length) continue;
    colliders.push({
      ownerId: asteroid.id,
      meshes: asteroid.colliderMeshes,
      isPlayer: false,
      kind: "asteroid" as const,
    });
  }

  return colliders;
}
