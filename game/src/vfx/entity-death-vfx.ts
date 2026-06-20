import { ParticleFx } from '@rogue-leader/engine';
import type { Vector3, Quaternion } from '@babylonjs/core';
import type { BabylonHost } from '@rogue-leader/engine';
import type { EntityId } from '../ecs/entity-id';
import type { World } from '../ecs/world';
import type {
  DeathEffectManager,
  DeathEffectSpawnKinematics,
} from './death-effect-manager';

export interface EntityDeathVfxContext {
  host: BabylonHost;
  world: World;
  deathEffects: DeathEffectManager;
}

export interface SpawnEntityDeathVfxOptions {
  entityId?: EntityId;
  deathPrefabId?: string;
  position: Vector3;
  kinematics: DeathEffectSpawnKinematics;
  playExplosion?: boolean;
}

function resolveDeathPrefabId(
  ctx: EntityDeathVfxContext,
  entityId: EntityId | undefined,
  explicitPrefabId?: string,
): string | undefined {
  if (explicitPrefabId?.trim()) return explicitPrefabId.trim();
  if (!entityId) return undefined;
  return ctx.world.get(entityId, 'deathEffectRef')?.prefabId;
}

/** Spawn configured death prefab; optional generic explosion when no prefab is available. */
export function spawnEntityDeathVfx(
  ctx: EntityDeathVfxContext,
  options: SpawnEntityDeathVfxOptions,
): void {
  const prefabId = resolveDeathPrefabId(ctx, options.entityId, options.deathPrefabId);
  const spawnedPrefab =
    prefabId && ctx.deathEffects.spawn(prefabId, options.kinematics);

  if (options.playExplosion !== false && !spawnedPrefab) {
    ParticleFx.explosion(ctx.host.scene, options.position);
  }
}

export type { DeathEffectSpawnKinematics };
