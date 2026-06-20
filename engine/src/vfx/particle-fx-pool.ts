import {
  Color4,
  ParticleSystem,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { ObjectPool } from "../pool/object-pool";
import { getFlareTexture } from "./vfx-textures";

type BurstKind = "explosion" | "hitSpark";

const BURST_RELEASE_SEC: Record<BurstKind, number> = {
  explosion: 1.1,
  hitSpark: 0.35,
};

const POOL_HIDE_POSITION = new Vector3(0, -5000, 0);

export class ParticleFxPool {
  private readonly explosionPool: ObjectPool<ParticleSystem>;
  private readonly hitSparkPool: ObjectPool<ParticleSystem>;

  constructor(private readonly scene: Scene) {
    this.explosionPool = ObjectPool.create({
      factory: () => this.createExplosionSystem(),
      reset: (ps) => this.resetBurstSystem(ps),
      destroy: (ps) => ps.dispose(),
      maxSize: 12,
    });
    this.hitSparkPool = ObjectPool.create({
      factory: () => this.createHitSparkSystem(),
      reset: (ps) => this.resetBurstSystem(ps),
      destroy: (ps) => ps.dispose(),
      maxSize: 24,
    });

    this.explosionPool.prewarm(4);
    this.hitSparkPool.prewarm(8);
  }

  playExplosion(position: Vector3): void {
    this.playBurst(this.explosionPool.acquire(), "explosion", position);
  }

  playHitSpark(position: Vector3): void {
    this.playBurst(this.hitSparkPool.acquire(), "hitSpark", position);
  }

  dispose(): void {
    this.explosionPool.drain();
    this.hitSparkPool.drain();
  }

  private playBurst(
    ps: ParticleSystem,
    kind: BurstKind,
    position: Vector3,
  ): void {
    this.applyAdditiveBurstBlend(ps);
    ps.emitter = position.clone();
    ps.manualEmitCount = kind === "explosion" ? 120 : 30;
    ps.start();

    const releaseSec = BURST_RELEASE_SEC[kind];
    setTimeout(() => {
      ps.stop();
      if (kind === "explosion") {
        this.explosionPool.release(ps);
      } else {
        this.hitSparkPool.release(ps);
      }
    }, releaseSec * 1000);
  }

  private resetBurstSystem(ps: ParticleSystem): void {
    ps.stop();
    ps.emitter = POOL_HIDE_POSITION;
    this.applyAdditiveBurstBlend(ps);
  }

  private createExplosionSystem(): ParticleSystem {
    const ps = new ParticleSystem("explosion_pooled", 120, this.scene);
    this.applyAdditiveBurstBlend(ps);
    ps.minEmitBox = ps.maxEmitBox = Vector3.Zero();
    ps.color1 = new Color4(1, 0.6, 0.1, 1);
    ps.color2 = new Color4(1, 0.2, 0, 0.5);
    ps.minSize = 0.3;
    ps.maxSize = 1.2;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 800;
    ps.gravity = Vector3.Zero();
    ps.targetStopDuration = 0.5;
    ps.disposeOnStop = false;
    return ps;
  }

  private createHitSparkSystem(): ParticleSystem {
    const ps = new ParticleSystem("hit_pooled", 30, this.scene);
    this.applyAdditiveBurstBlend(ps);
    ps.color1 = new Color4(0.5, 0.8, 1, 1);
    ps.color2 = new Color4(1, 1, 1, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.05;
    ps.maxLifeTime = 0.2;
    ps.emitRate = 200;
    ps.targetStopDuration = 0.15;
    ps.disposeOnStop = false;
    return ps;
  }

  /** Additive glow using particle alpha × texture (requires hasAlpha flare). */
  private applyAdditiveBurstBlend(ps: ParticleSystem): void {
    ps.particleTexture = getFlareTexture(this.scene);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  }
}

const scenePools = new WeakMap<Scene, ParticleFxPool>();

export function getParticleFxPool(scene: Scene): ParticleFxPool {
  let pool = scenePools.get(scene);
  if (!pool) {
    pool = new ParticleFxPool(scene);
    scenePools.set(scene, pool);
  }
  return pool;
}

export function disposeParticleFxPool(scene: Scene): void {
  const pool = scenePools.get(scene);
  pool?.dispose();
  scenePools.delete(scene);
}
