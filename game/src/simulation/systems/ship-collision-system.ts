import { Vector3 } from '@babylonjs/core';
import { buildSphereBody, getEffectiveCollisionBounds } from '../../collision/collision-system';
import {
  computeCollisionDamage,
  resolveSphereCollision,
} from '../../collision/ship-collision-response';
import {
  DEFAULT_ASTEROID_CONTACT_MATERIAL,
  DEFAULT_SHIP_CONTACT_MATERIAL,
} from '../../physics/ship-contact-math';
import { Role as EntityRole } from '../../ecs/components/role-tag';
import { entityToSphereBody } from '../../ecs/queries/combat-queries';
import {
  applyShipCollisionResponse,
  getShipPosition,
  getShipVelocity,
} from '../../ecs/queries/ship-queries';
import type { EntityId } from '../../ecs/entity-id';
import { GameEvents } from '../../core/events/game-events';
import type { MissionRuntimeContext } from '../runtime-context';
import { destroyNpcEntity } from './damage-resolution-system';

const COLLISION_COOLDOWN_SEC = 0.9;

export interface ShipCollisionState {
  pairCooldowns: Map<string, number>;
}

export function createShipCollisionState(): ShipCollisionState {
  return { pairCooldowns: new Map() };
}

interface CollisionParticipant {
  id: EntityId;
  role: typeof EntityRole.Player | typeof EntityRole.Npc | typeof EntityRole.Asteroid;
  body: NonNullable<ReturnType<typeof entityToSphereBody>>;
  radius: number;
}

export function updateShipCollisions(
  ctx: MissionRuntimeContext,
  state: ShipCollisionState,
  dt: number,
): void {
  for (const [key, remaining] of [...state.pairCooldowns.entries()]) {
    const next = remaining - dt;
    if (next <= 0) state.pairCooldowns.delete(key);
    else state.pairCooldowns.set(key, next);
  }

  const participants = collectCollisionParticipants(ctx);
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      resolveParticipantPair(ctx, state, participants[i], participants[j]);
    }
  }
}

function collectCollisionParticipants(
  ctx: MissionRuntimeContext,
): CollisionParticipant[] {
  const world = ctx.world;
  const participants: CollisionParticipant[] = [];

  for (const id of world.queryByRole(EntityRole.Player)) {
    if (!world.has(id, 'flight')) continue;
    const health = world.get(id, 'health');
    const body = entityToSphereBody(world, id);
    const collider = world.get(id, 'collider');
    if (!health || health.isDead() || !body || !collider) continue;
    participants.push({
      id,
      role: EntityRole.Player,
      body,
      radius: collider.radius,
    });
  }

  for (const id of world.queryByRole(EntityRole.Npc)) {
    if (!world.has(id, 'flight')) continue;
    const health = world.get(id, 'health');
    const body = entityToSphereBody(world, id);
    const collider = world.get(id, 'collider');
    if (!health || health.isDead() || !body || !collider) continue;
    participants.push({
      id,
      role: EntityRole.Npc,
      body,
      radius: collider.radius,
    });
  }

  if (ctx.config.asteroids) {
    for (const id of world.queryByRole(EntityRole.Asteroid)) {
      const asteroid = world.get(id, 'asteroidBody');
      const health = world.get(id, 'health');
      if (!asteroid || !health || health.isDead()) continue;
      participants.push({
        id,
        role: EntityRole.Asteroid,
        body: buildSphereBody({
          id,
          position: asteroid.root.position,
          radius: asteroid.colliderRadius,
          team: 'neutral',
          faction: 'neutral',
          colliderMeshes: asteroid.colliderMeshes,
        }),
        radius: asteroid.colliderRadius,
      });
    }
  }

  return participants;
}

function resolveParticipantPair(
  ctx: MissionRuntimeContext,
  state: ShipCollisionState,
  a: CollisionParticipant,
  b: CollisionParticipant,
): void {
  if (a.role === EntityRole.Asteroid && b.role === EntityRole.Asteroid) return;

  const pairKey = pairCooldownKey(a.id, b.id);
  if ((state.pairCooldowns.get(pairKey) ?? 0) > 0) return;
  if (!ctx.collision.sphereOverlap(a.body, b.body)) return;

  const velA = a.body.velocity ?? Vector3.Zero();
  const velB = b.body.velocity ?? Vector3.Zero();
  const boundsA = getEffectiveCollisionBounds(a.body, a.radius);
  const boundsB = getEffectiveCollisionBounds(b.body, b.radius);
  const material =
    a.role === EntityRole.Asteroid || b.role === EntityRole.Asteroid
      ? DEFAULT_ASTEROID_CONTACT_MATERIAL
      : DEFAULT_SHIP_CONTACT_MATERIAL;
  const massA = a.role === EntityRole.Asteroid ? 8 : 1;
  const massB = b.role === EntityRole.Asteroid ? 8 : 1;

  const resolved = resolveSphereCollision({
    positionA: boundsA.center,
    radiusA: boundsA.radius,
    velocityA: velA,
    positionB: boundsB.center,
    radiusB: boundsB.radius,
    velocityB: velB,
    massA,
    massB,
    material,
  });
  if (!resolved || resolved.relativeApproach < 1) return;

  applyShipCollisionResponse(
    ctx.world,
    a.id,
    resolved.pushA,
    resolved.relativeApproach,
    resolved.velocityDeltaA,
  );
  applyShipCollisionResponse(
    ctx.world,
    b.id,
    resolved.pushB,
    resolved.relativeApproach,
    resolved.velocityDeltaB,
  );

  const damage = collisionDamageForPair(
    ctx,
    a.role,
    b.role,
    resolved.relativeApproach,
    resolved.headOnFactor,
  );
  if (damage > 0) {
    applyCollisionDamage(ctx, a, b, damage, resolved.contactPoint);
  }

  if (a.role === EntityRole.Player || b.role === EntityRole.Player) {
    ctx.camera.shake(a.role === EntityRole.Asteroid || b.role === EntityRole.Asteroid ? 0.35 : 0.22);
  }

  state.pairCooldowns.set(pairKey, COLLISION_COOLDOWN_SEC);
}

function pairCooldownKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function collisionDamageForPair(
  ctx: MissionRuntimeContext,
  roleA: CollisionParticipant['role'],
  roleB: CollisionParticipant['role'],
  relativeApproach: number,
  headOnFactor: number,
): number {
  const speedDamage = computeCollisionDamage(relativeApproach, headOnFactor);
  if (roleA === EntityRole.Asteroid || roleB === EntityRole.Asteroid) {
    const configured = ctx.config.asteroids?.damageOnImpact ?? 0;
    return Math.max(configured, speedDamage);
  }
  return speedDamage;
}

function applyCollisionDamage(
  ctx: MissionRuntimeContext,
  a: CollisionParticipant,
  b: CollisionParticipant,
  damage: number,
  contactPoint: Vector3,
): void {
  applyParticipantCollisionDamage(ctx, a, b.role, damage, contactPoint);
  applyParticipantCollisionDamage(ctx, b, a.role, damage, contactPoint);
}

function applyParticipantCollisionDamage(
  ctx: MissionRuntimeContext,
  participant: CollisionParticipant,
  otherRole: CollisionParticipant['role'],
  damage: number,
  contactPoint: Vector3,
): void {
  if (participant.role === EntityRole.Asteroid) return;
  if (ctx.debugPreferences.gameplay.invincible && participant.role === EntityRole.Player) {
    return;
  }

  const world = ctx.world;
  const health = world.get(participant.id, 'health');
  if (!health || health.isDead()) return;

  const result = health.applyDamage(damage);
  const position = getShipPosition(world, participant.id).clone();
  const velocity = getShipVelocity(world, participant.id).clone();

  ctx.events.emit(
    GameEvents.shipCollision({
      position: contactPoint.clone(),
      velocity,
    }),
  );

  if (participant.role === EntityRole.Player) {
    if (otherRole === EntityRole.Asteroid) {
      ctx.events.emit(GameEvents.asteroidImpact({ position }));
    }
    if (result.shield > 0) {
      ctx.events.emit(GameEvents.shieldHit({ position }));
    } else if (result.hull > 0) {
      ctx.events.emit(GameEvents.playerDamaged({ position }));
    }
    return;
  }

  if (participant.role === EntityRole.Npc && health.isDead()) {
    destroyNpcEntity(ctx, participant.id);
  }
}
