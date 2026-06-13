import { Vector3, type Mesh, type Scene } from '@babylonjs/core';
import type { CollisionSystem, SphereBody } from '../../collision/collision-system';
import { areFactionsHostile } from '../../combat/faction';
import type { FactionId } from '../../combat/faction';
import type { CombatTeam } from './combat-team';
import type { ProjectileConfig } from './projectile-config';
import { ProjectileBehaviors } from '../../constants/weapon-behaviors';
import {
  closestPointOnSegment,
  detectProjectileNearMiss,
  type ProjectilePassByObserver,
} from '../../audio/projectile-pass-by';
import {
  ProjectileMeshPool,
  syncProjectileMeshTransform,
  type PooledProjectileMesh,
} from '@rogue-leader/engine';

export interface ProjectileHit {
  point: Vector3;
  targetId: string;
  team: CombatTeam;
  damage: number;
  weaponId: string;
  behavior?: string;
}

export interface ProjectileSpawnOptions {
  origin: Vector3;
  direction: Vector3;
  team: CombatTeam;
  faction: FactionId;
  shooterId: string;
  config: ProjectileConfig;
  damage: number;
  weaponId: string;
}

export class Projectile {
  readonly team: CombatTeam;
  readonly faction: FactionId;
  readonly shooterId: string;
  readonly damage: number;
  readonly weaponId: string;
  readonly behavior?: string;
  private readonly mesh: Mesh;
  private readonly meshPool: ProjectileMeshPool;
  private readonly meshSlot: PooledProjectileMesh;
  private direction: Vector3;
  private readonly config: ProjectileConfig;
  private distanceTraveled = 0;
  private active = false;
  private whooshTriggered = false;

  private constructor(
    meshPool: ProjectileMeshPool,
    meshSlot: PooledProjectileMesh,
    options: ProjectileSpawnOptions
  ) {
    this.meshPool = meshPool;
    this.meshSlot = meshSlot;
    this.mesh = meshSlot.mesh;
    this.team = options.team;
    this.faction = options.faction;
    this.shooterId = options.shooterId;
    this.damage = options.damage;
    this.weaponId = options.weaponId;
    this.behavior = options.config.behavior;
    this.config = options.config;
    this.direction = options.direction.clone().normalize();
    this.activate(options);
  }

  static spawn(
    scene: Scene,
    meshPool: ProjectileMeshPool,
    options: ProjectileSpawnOptions
  ): Projectile {
    const meshSlot = meshPool.acquire(scene, options.config.visual);
    return new Projectile(meshPool, meshSlot, options);
  }

  private get speed(): number {
    return this.config.speed;
  }

  private activate(options: ProjectileSpawnOptions): void {
    this.active = true;
    this.distanceTraveled = 0;
    this.whooshTriggered = false;
    this.direction = options.direction.clone().normalize();
    this.mesh.setEnabled(true);
    this.mesh.isVisible = true;
    syncProjectileMeshTransform(this.mesh, options.origin, this.direction);
  }

  update(
    dt: number,
    collision: CollisionSystem,
    targets: SphereBody[],
    onHit: (hit: ProjectileHit) => void,
    passByObserver?: ProjectilePassByObserver,
    onPassBy?: (weaponId: string, point: Vector3, velocity: Vector3) => void
  ): boolean {
    if (!this.active) return false;

    if (this.config.behavior === ProjectileBehaviors.MissileHoming && this.config.homing) {
      this.steerHoming(dt, targets);
    }

    const velocity = this.direction.scale(this.speed);
    const step = velocity.scale(dt);
    const stepLen = step.length();
    const prev = this.mesh.position.clone();
    const next = prev.add(step);
    this.distanceTraveled += stepLen;

    if (
      passByObserver &&
      onPassBy &&
      !this.whooshTriggered &&
      detectProjectileNearMiss(
        prev,
        next,
        passByObserver,
        this.team,
        this.distanceTraveled
      )
    ) {
      this.whooshTriggered = true;
      onPassBy(this.weaponId, closestPointOnSegment(prev, next, passByObserver.position), velocity);
    }

    const projectileBody: SphereBody = {
      id: `projectile_${this.team}`,
      position: next,
      radius: this.config.hitRadius,
      team: this.team,
    };

    let closest = stepLen + 1;
    let hitTarget: SphereBody | undefined;
    let hitPoint = next;

    for (const target of targets) {
      if (!this.isHittableTarget(target)) continue;

      const swept = collision.raycastSphere(prev.clone(), this.direction, target, stepLen);
      if (swept.hit && swept.distance < closest) {
        closest = swept.distance;
        hitTarget = target;
        hitPoint = swept.point;
      }

      if (collision.sphereOverlap(projectileBody, target)) {
        const dist = Vector3.Distance(prev, target.position);
        if (dist < closest) {
          closest = dist;
          hitTarget = target;
          hitPoint = target.colliderMeshes?.length
            ? collision.raycastMeshColliders(prev, this.direction, target.colliderMeshes, stepLen).point
            : target.position.clone();
        }
      } else if (target.colliderMeshes?.length && collision.sphereOverlapsMeshColliders(projectileBody)) {
        const meshHit = collision.raycastMeshColliders(prev, this.direction, target.colliderMeshes, stepLen);
        if (meshHit.hit && meshHit.distance < closest) {
          closest = meshHit.distance;
          hitTarget = target;
          hitPoint = meshHit.point;
        }
      }
    }

    if (hitTarget) {
      onHit({
        point: hitPoint,
        targetId: hitTarget.id,
        team: this.team,
        damage: this.damage,
        weaponId: this.weaponId,
        behavior: this.behavior,
      });
      this.release();
      return false;
    }

    if (this.distanceTraveled >= this.config.maxRange) {
      this.release();
      return false;
    }

    syncProjectileMeshTransform(this.mesh, next, this.direction);
    return true;
  }

  private steerHoming(dt: number, targets: SphereBody[]): void {
    const homing = this.config.homing;
    if (!homing) return;

    const origin = this.mesh.position;
    let best: SphereBody | undefined;
    let bestDist = homing.acquireRange;

    for (const target of targets) {
      if (!this.isHomingTarget(target)) continue;
      const dist = Vector3.Distance(origin, target.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = target;
      }
    }

    if (!best) return;

    const desired = best.position.subtract(origin).normalize();
    const turn = Math.min(1, homing.turnRate * dt);
    this.direction = Vector3.Lerp(this.direction, desired, turn).normalize();
  }

  private isHittableTarget(target: SphereBody): boolean {
    return target.id !== this.shooterId;
  }

  private isHomingTarget(target: SphereBody): boolean {
    if (target.id === this.shooterId) return false;
    if (target.faction) {
      return areFactionsHostile(this.faction, target.faction);
    }
    return target.team !== this.team && target.team !== 'neutral';
  }

  getDebugSnapshot(id: string): {
    id: string;
    position: Vector3;
    direction: Vector3;
    team: CombatTeam;
    weaponId: string;
  } {
    return {
      id,
      position: this.mesh.position.clone(),
      direction: this.direction.clone(),
      team: this.team,
      weaponId: this.weaponId,
    };
  }

  release(): void {
    if (!this.active) return;
    this.active = false;
    this.meshPool.release(this.config.visual, this.meshSlot);
  }

  dispose(): void {
    this.release();
  }

  isActive(): boolean {
    return this.active;
  }
}
