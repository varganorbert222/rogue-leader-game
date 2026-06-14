import { buildSphereBody, type SphereBody } from '../../../collision/collision-system';

import { Role } from '../../../ecs/components/role-tag';

import { entityToSphereBody } from '../../../ecs/queries/combat-queries';

import { getShipPosition } from '../../../ecs/queries/ship-queries';

import { GameEvents } from '../../../core/events/game-events';

import type { MissionRuntimeContext } from '../mission-runtime-context';



export function updatePlayerAsteroidCollisions(

  ctx: MissionRuntimeContext,

  cooldownSec: number,

): number {

  const world = ctx.world;

  const playerId = world.playerEntity;

  if (!playerId || !ctx.config.asteroids) return cooldownSec;

  if (cooldownSec > 0) return cooldownSec;

  const playerBody = entityToSphereBody(world, playerId);
  const playerHealth = world.get(playerId, 'health');
  if (!playerBody || !playerHealth) return cooldownSec;

  for (const asteroidId of world.queryByRole(Role.Asteroid)) {

    const body = world.get(asteroidId, 'asteroidBody');

    if (!body) continue;



    const asteroidBody = buildSphereBody({

      id: asteroidId,

      position: body.root.position,

      radius: body.colliderRadius,

      team: 'neutral',

      faction: 'neutral',

      colliderMeshes: body.colliderMeshes,

    });

    if (!ctx.collision.sphereOverlap(playerBody, asteroidBody)) continue;



    if (!ctx.debugPreferences.gameplay.invincible) {

      const result = playerHealth.applyDamage(

        ctx.config.asteroids.damageOnImpact,

      );

      const playerPos = getShipPosition(world, playerId).clone();

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



  return cooldownSec;

}

