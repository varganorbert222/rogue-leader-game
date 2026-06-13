import { Scene, Vector3 } from '@babylonjs/core';
import { getParticleFxPool } from './particle-fx-pool';

export class ParticleFx {
  static explosion(scene: Scene, position: Vector3): void {
    getParticleFxPool(scene).playExplosion(position);
  }

  static hitSpark(scene: Scene, position: Vector3): void {
    getParticleFxPool(scene).playHitSpark(position);
  }

  static attachDebrisSmoke(scene: Scene, emitter: import('@babylonjs/core').AbstractMesh) {
    return getParticleFxPool(scene).attachDebrisSmoke(emitter);
  }

  static attachDebrisFire(scene: Scene, emitter: import('@babylonjs/core').AbstractMesh) {
    return getParticleFxPool(scene).attachDebrisFire(emitter);
  }

  static releaseDebrisEffect(scene: Scene, ps: import('@babylonjs/core').ParticleSystem): void {
    getParticleFxPool(scene).releaseDebrisEffect(ps);
  }
}
