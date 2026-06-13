import { Vector3, type Scene } from "@babylonjs/core";
import {
  ParticleFx,
  type AssetManifest,
  type BabylonHost,
  updateLod,
  type LodRuntimeState,
} from "@rogue-leader/engine";
import type { WeaponsManifest } from "../data/config/weapons-manifest";
import { ActorRoles, EntityDestroyKinds, SfxClipIds } from "../data/constants";
import type { NpcActor } from "../actors/npc-actor";
import type { ActorWorld } from "../actors/actor-world";
import type { DebugPreferences } from "../debug/debug-preferences";
import type { GameEventBus } from "../events/game-events";
import { GameEvents } from "../events/game-events";
import type { CameraController } from "../flight/camera-controller";
import type { AsteroidField, AsteroidInstance } from "../hazards/asteroid-field";
import type { MissionAssetPreloader } from "../loading/mission-asset-preloader";
import type { WreckDebrisManager } from "../vfx/wreck-debris-manager";
import {
  buildSphereBody,
  type CollisionSystem,
  type SphereBody,
} from "../collision/collision-system";
import type { WeaponHitSfxResolver } from "../audio/weapon-hit-sfx";
import type { CombatSystem, ProjectileHit } from "../weapons/combat-system";
import type { VehicleWeaponSystem } from "../weapons/core/vehicle-weapon-system";
import type { MissionConfig } from "./mission-types";

export interface MissionCombatHandlerContext {
  host: BabylonHost;
  world: ActorWorld;
  combat: CombatSystem;
  asteroidField: AsteroidField;
  collision: CollisionSystem;
  camera: CameraController;
  wreckDebris: WreckDebrisManager;
  assetPreloader: MissionAssetPreloader;
  assetManifest: AssetManifest;
  weaponsManifest: WeaponsManifest;
  hitSfxResolver?: WeaponHitSfxResolver;
  events: GameEventBus;
  debugPreferences: DebugPreferences;
  config: MissionConfig;
}

export function collectMissionWeaponSystems(
  world: ActorWorld,
): VehicleWeaponSystem[] {
  const systems = world.npcActors.map((npc) => npc.vehicle.weapons);
  if (world.player) {
    systems.push(world.player.vehicle.weapons);
  }
  return systems;
}

export function collectProjectileTargets(
  world: ActorWorld,
  asteroidField: AsteroidField,
): SphereBody[] {
  const targets = world.collectActorSphereBodies();

  for (const asteroid of asteroidField.asteroids) {
    targets.push(
      buildSphereBody({
        id: asteroid.id,
        position: asteroid.root.position,
        radius: asteroid.colliderRadius,
        team: "neutral",
        faction: "neutral",
        colliderMeshes: asteroid.colliderMeshes,
      }),
    );
  }

  return targets;
}

export function handleProjectileHit(
  ctx: MissionCombatHandlerContext,
  hit: ProjectileHit,
): void {
  ParticleFx.hitSpark(ctx.host.scene, hit.point);
  const hitSfx =
    ctx.hitSfxResolver?.resolve(hit.weaponId, hit.behavior) ??
    ctx.weaponsManifest.weapons[hit.weaponId]?.audio?.hit ??
    SfxClipIds.BulletHit;
  ctx.events.emit(
    GameEvents.projectileHit({
      weaponId: hit.weaponId,
      behavior: hit.behavior,
      sfx: hitSfx,
      position: hit.point.clone(),
    }),
  );

  if (!hit.targetId) return;

  const actor = ctx.world.findActor(hit.targetId);
  if (actor) {
    if (actor.role === ActorRoles.Player) {
      if (!ctx.debugPreferences.gameplay.invincible) {
        const result = actor.health.applyDamage(hit.damage);
        const playerPos = actor.vehicle.position.clone();
        if (result.shield > 0) {
          ctx.events.emit(GameEvents.shieldHit({ position: playerPos }));
        } else {
          ctx.events.emit(GameEvents.playerDamaged({ position: playerPos }));
        }
      }
      ctx.camera.shake();
      return;
    }

    actor.health.applyDamage(hit.damage);
    if (actor.health.isDead()) destroyMissionNpc(ctx, actor as NpcActor);
    return;
  }

  const asteroid = ctx.asteroidField.asteroids.find(
    (a) => a.id === hit.targetId,
  );
  if (asteroid) {
    asteroid.health.applyDamage(hit.damage);
    if (asteroid.health.isDead()) destroyMissionAsteroid(ctx, asteroid);
  }
}

export function destroyMissionNpc(
  ctx: MissionCombatHandlerContext,
  npc: NpcActor,
): void {
  const entry = ctx.assetManifest.ships[npc.vehicle.shipId];
  if (entry) {
    ctx.wreckDebris.spawnFromVehicle(npc.vehicle.shipId, entry, npc.vehicle);
  }
  ParticleFx.explosion(ctx.host.scene, npc.vehicle.position);
  ctx.events.emit(
    GameEvents.entityDestroyed({
      kind: EntityDestroyKinds.Fighter,
      shipId: npc.vehicle.shipId,
      position: npc.vehicle.position.clone(),
    }),
  );
  ctx.world.removeNpc(npc.id);
  npc.vehicle.prepareForPool();
  ctx.assetPreloader.shipPool.releaseNpcShip(
    npc.vehicle.shipId,
    npc.vehicle.loadedEntity,
  );
}

export function destroyMissionAsteroid(
  ctx: Pick<MissionCombatHandlerContext, "host" | "events" | "asteroidField">,
  asteroid: AsteroidInstance,
): void {
  ParticleFx.explosion(ctx.host.scene, asteroid.root.position);
  ctx.events.emit(
    GameEvents.entityDestroyed({
      kind: EntityDestroyKinds.Asteroid,
      position: asteroid.root.position.clone(),
    }),
  );
  ctx.asteroidField.remove(asteroid.id);
}

export function checkAsteroidCollisions(
  ctx: MissionCombatHandlerContext,
  asteroidHitCooldown: number,
): number {
  const player = ctx.world.player;
  if (!player || !ctx.config.asteroids) return asteroidHitCooldown;
  if (asteroidHitCooldown > 0) return asteroidHitCooldown;

  const playerBody: SphereBody = {
    id: player.id,
    position: player.vehicle.position,
    radius: player.vehicle.colliderRadius,
    team: player.vehicle.combatTeam,
    faction: player.faction,
    colliderMeshes: player.vehicle.colliderMeshes,
  };

  for (const asteroid of ctx.asteroidField.asteroids) {
    const aBody = buildSphereBody({
      id: asteroid.id,
      position: asteroid.root.position,
      radius: asteroid.colliderRadius,
      team: "neutral",
      faction: "neutral",
      colliderMeshes: asteroid.colliderMeshes,
    });
    if (ctx.collision.sphereOverlap(playerBody, aBody)) {
      if (!ctx.debugPreferences.gameplay.invincible) {
        const result = player.health.applyDamage(
          ctx.config.asteroids.damageOnImpact,
        );
        const playerPos = player.vehicle.position.clone();
        if (result.shield > 0) {
          ctx.events.emit(GameEvents.shieldHit({ position: playerPos }));
        } else {
          ctx.events.emit(GameEvents.playerDamaged({ position: playerPos }));
          ctx.events.emit(GameEvents.asteroidImpact({ position: playerPos }));
        }
      }
      ctx.camera.shake(0.35);
      return 1.0;
    }
  }

  return asteroidHitCooldown;
}

export function updateMissionLod(
  scene: Scene,
  world: ActorWorld,
  extraLodStates: readonly LodRuntimeState[] = [],
): void {
  scene.updateTransformMatrix(true);

  for (const actor of world.allActors()) {
    updateLod(scene, actor.vehicle.lodRuntime);
  }

  for (const state of extraLodStates) {
    updateLod(scene, state);
  }
}
