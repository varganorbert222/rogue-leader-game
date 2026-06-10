import {
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import type { CollisionSystem, SphereBody } from '../../collision/collision-system';
import type { CombatTeam } from './combat-team';
import type { ProjectileConfig } from './projectile-config';

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
  config: ProjectileConfig;
  damage: number;
  weaponId: string;
}

export class Projectile {
  readonly team: CombatTeam;
  readonly damage: number;
  readonly weaponId: string;
  readonly behavior?: string;
  private readonly mesh: Mesh;
  private direction: Vector3;
  private readonly config: ProjectileConfig;
  private distanceTraveled = 0;
  private disposed = false;

  constructor(scene: Scene, options: ProjectileSpawnOptions) {
    this.team = options.team;
    this.damage = options.damage;
    this.weaponId = options.weaponId;
    this.behavior = options.config.behavior;
    this.config = options.config;
    this.direction = options.direction.clone().normalize();

    const { visual } = this.config;
    this.mesh = MeshBuilder.CreateCylinder(
      `projectile_${options.weaponId}_${options.team}`,
      {
        diameter: visual.boltDiameter,
        height: visual.boltLength,
        tessellation: 6,
      },
      scene
    );
    const mat = new StandardMaterial(`projectileMat_${options.weaponId}`, scene);
    mat.emissiveColor.set(visual.emissive[0], visual.emissive[1], visual.emissive[2]);
    mat.disableLighting = true;
    mat.alpha = 0.95;
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.syncMeshTransform(options.origin);
  }

  private get speed(): number {
    return this.config.speed;
  }

  update(
    dt: number,
    collision: CollisionSystem,
    targets: SphereBody[],
    onHit: (hit: ProjectileHit) => void
  ): boolean {
    if (this.disposed) return false;

    if (this.config.behavior === 'missile_homing' && this.config.homing) {
      this.steerHoming(dt, targets);
    }

    const velocity = this.direction.scale(this.speed);
    const step = velocity.scale(dt);
    const stepLen = step.length();
    const prev = this.mesh.position.clone();
    const next = prev.add(step);
    this.distanceTraveled += stepLen;

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
      if (target.team === this.team) continue;

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
          hitPoint = target.position.clone();
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
      this.dispose();
      return false;
    }

    if (this.distanceTraveled >= this.config.maxRange) {
      this.dispose();
      return false;
    }

    this.syncMeshTransform(next);
    return true;
  }

  private steerHoming(dt: number, targets: SphereBody[]): void {
    const homing = this.config.homing;
    if (!homing) return;

    const origin = this.mesh.position;
    let best: SphereBody | undefined;
    let bestDist = homing.acquireRange;

    for (const target of targets) {
      if (target.team === this.team) continue;
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
  }

  private syncMeshTransform(position: Vector3): void {
    this.mesh.position.copyFrom(position);
    if (this.direction.lengthSquared() < 1e-6) return;
    this.mesh.lookAt(position.add(this.direction));
    this.mesh.rotation.x += Math.PI / 2;
  }
}
