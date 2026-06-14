import { buildSphereBody, type SphereBody } from '../../collision/collision-system';
import { isAutoAimCandidate } from '../../combat/faction';
import type { FactionId } from '../../combat/faction';
import type { TargetEntity } from '../../combat/targeting/targeting-system';
import { Role } from '../components/role-tag';
import type { World } from '../world';
import type { EntityId } from '../entity-id';
import {
  getShipPosition,
  getShipVelocity,
  isShipEntity,
} from './ship-queries';

export function entityToTargetEntity(
  world: World,
  id: EntityId,
): TargetEntity | undefined {
  if (!isShipEntity(world, id)) return undefined;
  const faction = world.get(id, 'faction');
  const collider = world.get(id, 'collider');
  if (faction === undefined || !collider) return undefined;
  return {
    id,
    faction,
    position: getShipPosition(world, id).clone(),
    velocity: getShipVelocity(world, id).clone(),
    radius: collider.radius,
  };
}

export function entityToSphereBody(
  world: World,
  id: EntityId,
): SphereBody | undefined {
  if (!isShipEntity(world, id)) return undefined;
  const faction = world.get(id, 'faction');
  const collider = world.get(id, 'collider');
  const shipIdentity = world.get(id, 'shipIdentity');
  if (faction === undefined || !collider || !shipIdentity) return undefined;
  return buildSphereBody({
    id,
    position: getShipPosition(world, id),
    radius: collider.radius,
    team: shipIdentity.combatTeam,
    faction,
    velocity: getShipVelocity(world, id),
    colliderMeshes: collider.meshes,
  });
}

export function collectHostileTargets(
  world: World,
  observerFaction: FactionId,
): TargetEntity[] {
  return world
    .queryByRole(Role.Npc)
    .filter((id) => {
      const faction = world.get(id, 'faction');
      return faction !== undefined && isAutoAimCandidate(observerFaction, faction);
    })
    .map((id) => entityToTargetEntity(world, id)!);
}

export function collectShipSphereBodies(world: World): SphereBody[] {
  const bodies: SphereBody[] = [];
  for (const id of world.query('role', 'flight', 'faction')) {
    const role = world.get(id, 'role');
    if (role === Role.Asteroid) continue;
    const body = entityToSphereBody(world, id);
    if (body) bodies.push(body);
  }
  return bodies;
}

export function collectProjectileTargetBodies(world: World): SphereBody[] {
  const targets = collectShipSphereBodies(world);

  for (const id of world.queryByRole(Role.Asteroid)) {
    const body = world.get(id, 'asteroidBody');
    const health = world.get(id, 'health');
    if (!body || !health || health.isDead()) continue;
    targets.push(
      buildSphereBody({
        id,
        position: body.root.position,
        radius: body.colliderRadius,
        team: 'neutral',
        faction: 'neutral',
        colliderMeshes: body.colliderMeshes,
      }),
    );
  }

  return targets;
}

export function collectShipWeaponSystems(world: World) {
  const systems = [];
  for (const id of world.query('weapons', 'role')) {
    const role = world.get(id, 'role');
    if (role === Role.Asteroid) continue;
    const weapons = world.get(id, 'weapons');
    if (weapons) systems.push(weapons.system);
  }
  return systems;
}

export function collectLodRuntimes(world: World) {
  const states = [];
  for (const id of world.query('lod')) {
    const lod = world.get(id, 'lod');
    if (lod) states.push(lod.runtime);
  }
  for (const id of world.queryByRole(Role.Asteroid)) {
    const body = world.get(id, 'asteroidBody');
    if (body) states.push(body.lodRuntime);
  }
  return states;
}
