import { ParticleFx } from '@rogue-leader/engine';
import { ActorRoles, EntityDestroyKinds, SfxClipIds } from '../../../data/constants';
import type { NpcActor } from '../../../actors/npc-actor';
import { GameEvents } from '../../../core/events/game-events';
import type { AsteroidInstance } from '../../../hazards/asteroid-field';
import type { ProjectileHit } from '../../../combat/systems/combat-system';
import type { MissionRuntimeContext } from '../mission-runtime-context';

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

  const actor = ctx.world.actors.findActor(hit.targetId);
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
    if (actor.health.isDead()) {
      destroyNpc(ctx, actor as NpcActor);
    }
    return;
  }

  const asteroid = ctx.world.hazards.asteroids.find(
    (entry) => entry.id === hit.targetId,
  );
  if (asteroid) {
    asteroid.health.applyDamage(hit.damage);
    if (asteroid.health.isDead()) {
      destroyAsteroid(ctx, asteroid);
    }
  }
}

export function destroyNpc(ctx: MissionRuntimeContext, npc: NpcActor): void {
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
  ctx.world.actors.removeNpc(npc.id);
  npc.vehicle.prepareForPool();
  ctx.assetPreloader.shipPool.releaseNpcShip(
    npc.vehicle.shipId,
    npc.vehicle.loadedEntity,
  );
}

export function destroyAsteroid(
  ctx: Pick<MissionRuntimeContext, 'host' | 'events' | 'world'>,
  asteroid: AsteroidInstance,
): void {
  ParticleFx.explosion(ctx.host.scene, asteroid.root.position);
  ctx.events.emit(
    GameEvents.entityDestroyed({
      kind: EntityDestroyKinds.Asteroid,
      position: asteroid.root.position.clone(),
    }),
  );
  ctx.world.hazards.remove(asteroid.id);
}
