import type { Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import { CollisionSystem, type SphereBody } from '../../collision/collision-system';
import { Projectile, type ProjectileHit, type ProjectileSpawnOptions } from './projectile';
import { ProjectileMeshPool } from '@rogue-leader/engine';import type { ProjectilePassByObserver } from '../../audio/projectile-pass-by';

export type ProjectileHitCallback = (hit: ProjectileHit) => void;
export type ProjectilePassByCallback = (
  weaponId: string,
  point: Vector3,
  velocity: Vector3
) => void;

export class ProjectileManager {
  private readonly projectiles: Projectile[] = [];
  private readonly meshPool = new ProjectileMeshPool();
  private readonly collision = new CollisionSystem();
  private targetProvider: (() => SphereBody[]) | null = null;
  private onHit: ProjectileHitCallback | null = null;
  private onPassBy: ProjectilePassByCallback | null = null;
  private passByObserver: ProjectilePassByObserver | null = null;

  constructor(private readonly scene: Scene) {}

  setTargetProvider(provider: () => SphereBody[]): void {
    this.targetProvider = provider;
  }

  setHitCallback(callback: ProjectileHitCallback): void {
    this.onHit = callback;
  }

  setPassByCallback(callback: ProjectilePassByCallback): void {
    this.onPassBy = callback;
  }

  setPassByObserver(observer: ProjectilePassByObserver | null): void {
    this.passByObserver = observer;
  }

  spawn(options: ProjectileSpawnOptions): void {
    this.projectiles.push(Projectile.spawn(this.scene, this.meshPool, options));
  }

  setBloomStrength(strength: number): void {
    this.meshPool.setBloomStrength(strength);
  }

  update(dt: number): void {
    const targets = this.targetProvider?.() ?? [];

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const alive = projectile.update(
        dt,
        this.collision,
        targets,
        (hit) => {
          this.onHit?.(hit);
        },
        this.passByObserver ?? undefined,
        (weaponId, point, velocity) => {
          this.onPassBy?.(weaponId, point, velocity);
        }
      );
      if (!alive) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  getDebugSnapshots(): ReturnType<Projectile['getDebugSnapshot']>[] {
    return this.projectiles.map((projectile, index) =>
      projectile.getDebugSnapshot(`proj_${index}_${projectile.weaponId}`)
    );
  }

  dispose(): void {
    for (const projectile of this.projectiles) {
      projectile.dispose();
    }
    this.projectiles.length = 0;
    this.meshPool.dispose();
  }
}
