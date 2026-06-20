import { ParticleFx } from "@rogue-leader/engine";
import { Quaternion, Vector3 } from "@babylonjs/core";
import { EntityDestroyKinds, SfxClipIds } from "../../config/constants";
import { Role as EntityRole } from "../../ecs/components/role-tag";
import { GameEvents } from "../../core/events/game-events";
import type { EntityId } from "../../ecs/entity-id";
import {
  getShipPosition,
  getShipRotation,
  getShipVelocity,
  prepareShipForPool,
} from "../../ecs/queries/ship-queries";
import type { ProjectileHit } from "../../combat/systems/combat-system";
import { spawnEntityDeathVfx } from "../../vfx/entity-death-vfx";
import type { MissionRuntimeContext } from "../runtime-context";

export function resolveProjectileHit(
  ctx: MissionRuntimeContext,
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

  const world = ctx.world;
  const entityId = world.findEntity(hit.targetId);
  if (!entityId) return;

  const role = world.get(entityId, "role");
  const health = world.get(entityId, "health");
  if (!role || !health) return;

  if (role === EntityRole.Player) {
    if (!ctx.debugPreferences.gameplay.invincible) {
      const result = health.applyDamage(hit.damage);

      if (world.has(entityId, "flight")) {
        const playerPos = getShipPosition(world, entityId).clone();

        if (result.shield > 0) {
          ctx.events.emit(GameEvents.shieldHit({ position: playerPos }));
        } else {
          ctx.events.emit(GameEvents.playerDamaged({ position: playerPos }));
        }
      }
    }

    ctx.camera.shake();
    return;
  }

  if (role === EntityRole.Npc) {
    health.applyDamage(hit.damage);

    if (health.isDead()) {
      destroyNpcEntity(ctx, entityId);
    }

    return;
  }

  if (role === EntityRole.Asteroid) {
    health.applyDamage(hit.damage);

    if (health.isDead()) {
      destroyAsteroidEntity(ctx, entityId);
    }
  }
}

export function destroyNpcEntity(
  ctx: MissionRuntimeContext,
  entityId: EntityId,
): void {
  const world = ctx.world;
  const shipIdentity = world.get(entityId, "shipIdentity");
  if (!shipIdentity) return;

  const position = getShipPosition(world, entityId);

  spawnEntityDeathVfx(ctx, {
    entityId,
    position,
    kinematics: {
      position: position.clone(),
      rotationQuaternion: getShipRotation(world, entityId).clone(),
      velocity: getShipVelocity(world, entityId).clone(),
    },
  });

  ctx.events.emit(
    GameEvents.entityDestroyed({
      kind: EntityDestroyKinds.Fighter,
      shipId: shipIdentity.shipId,
      position: position.clone(),
    }),
  );

  prepareShipForPool(world, entityId);

  ctx.assetPreloader.shipPool.releaseNpcShip(
    shipIdentity.shipId,
    shipIdentity.loadedEntity,
  );

  world.despawn(entityId);
}

export function destroyAsteroidEntity(
  ctx: Pick<
    MissionRuntimeContext,
    "host" | "events" | "world" | "deathEffects" | "config" | "asteroids"
  >,
  entityId: EntityId,
): void {
  const body = ctx.world.get(entityId, "asteroidBody");
  if (!body) return;

  const position = body.root.getAbsolutePosition().clone();

  spawnEntityDeathVfx(ctx, {
    entityId,
    deathPrefabId: ctx.config.asteroids?.deathPrefabId,
    position,
    kinematics: {
      position,
      rotationQuaternion:
        body.root.absoluteRotationQuaternion?.clone() ??
        Quaternion.Identity(),
      velocity: Vector3.Zero(),
      scaling:
        body.root.absoluteScaling?.clone() ?? body.root.scaling.clone(),
    },
  });

  ctx.events.emit(
    GameEvents.entityDestroyed({
      kind: EntityDestroyKinds.Asteroid,
      position: position.clone(),
    }),
  );

  ctx.asteroids.remove(ctx.world, entityId);
}
