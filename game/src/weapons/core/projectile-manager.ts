import type { Scene } from '@babylonjs/core';
import { CollisionSystem, type SphereBody } from '../../collision/collision-system';
import { Projectile, type ProjectileHit, type ProjectileSpawnOptions } from './projectile';

export type ProjectileHitCallback = (hit: ProjectileHit) => void;

export class ProjectileManager {
  private readonly projectiles: Projectile[] = [];
  private readonly collision = new CollisionSystem();
  private targetProvider: (() => SphereBody[]) | null = null;
  private onHit: ProjectileHitCallback | null = null;

  constructor(private readonly scene: Scene) {}

  setTargetProvider(provider: () => SphereBody[]): void {
    this.targetProvider = provider;
  }

  setHitCallback(callback: ProjectileHitCallback): void {
    this.onHit = callback;
  }

  spawn(options: ProjectileSpawnOptions): void {
    this.projectiles.push(new Projectile(this.scene, options));
  }

  update(dt: number): void {
    const targets = this.targetProvider?.() ?? [];

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const alive = projectile.update(dt, this.collision, targets, (hit) => {
        this.onHit?.(hit);
      });
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
  }
}
