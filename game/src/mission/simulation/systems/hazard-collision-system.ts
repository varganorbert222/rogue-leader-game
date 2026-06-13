import { buildSphereBody, type SphereBody } from '../../../collision/collision-system';
import { GameEvents } from '../../../core/events/game-events';
import type { MissionRuntimeContext } from '../mission-runtime-context';

export function updatePlayerAsteroidCollisions(
  ctx: MissionRuntimeContext,
  cooldownSec: number,
): number {
  const player = ctx.world.actors.player;
  if (!player || !ctx.config.asteroids) return cooldownSec;
  if (cooldownSec > 0) return cooldownSec;

  const playerBody: SphereBody = {
    id: player.id,
    position: player.vehicle.position,
    radius: player.vehicle.colliderRadius,
    team: player.vehicle.combatTeam,
    faction: player.faction,
    colliderMeshes: player.vehicle.colliderMeshes,
  };

  for (const asteroid of ctx.world.hazards.asteroids) {
    const asteroidBody = buildSphereBody({
      id: asteroid.id,
      position: asteroid.root.position,
      radius: asteroid.colliderRadius,
      team: 'neutral',
      faction: 'neutral',
      colliderMeshes: asteroid.colliderMeshes,
    });
    if (!ctx.collision.sphereOverlap(playerBody, asteroidBody)) continue;

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

  return cooldownSec;
}
