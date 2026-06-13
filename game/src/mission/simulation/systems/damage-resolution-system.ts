import { ParticleFx } from '@rogue-leader/engine';

import { EntityDestroyKinds, SfxClipIds } from '../../../data/constants';

import { Role as EntityRole } from '../../../ecs/components/role-tag';

import { GameEvents } from '../../../core/events/game-events';

import type { EntityId } from '../../../ecs/entity-id';

import {

  getShipPosition,
  getShipRotation,
  getShipVelocity,
  prepareShipForPool,
} from '../../../ecs/queries/ship-queries';

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



  const world = ctx.world;

  const entityId = world.findEntity(hit.targetId);

  if (!entityId) return;



  const role = world.get(entityId, 'role');

  const health = world.get(entityId, 'health');

  if (!role || !health) return;



  if (role === EntityRole.Player) {

    if (!ctx.debugPreferences.gameplay.invincible) {

      const result = health.applyDamage(hit.damage);

      if (world.has(entityId, 'flight')) {

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

  const shipIdentity = world.get(entityId, 'shipIdentity');

  if (!shipIdentity) return;



  const entry = ctx.assetManifest.ships[shipIdentity.shipId];

  const position = getShipPosition(world, entityId);

  if (entry) {

    ctx.wreckDebris.spawnFromShip(

      shipIdentity.shipId,

      entry,

      {

        position: position.clone(),

        rotationQuaternion: getShipRotation(world, entityId).clone(),

        velocity: getShipVelocity(world, entityId).clone(),

      },

    );

  }

  ParticleFx.explosion(ctx.host.scene, position);

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

  ctx: Pick<MissionRuntimeContext, 'host' | 'events' | 'world'>,

  entityId: EntityId,

): void {

  const body = ctx.world.get(entityId, 'asteroidBody');

  if (!body) return;



  ParticleFx.explosion(ctx.host.scene, body.root.position);

  ctx.events.emit(

    GameEvents.entityDestroyed({

      kind: EntityDestroyKinds.Asteroid,

      position: body.root.position.clone(),

    }),

  );

  ctx.world.asteroids.remove(ctx.world, entityId);

}

