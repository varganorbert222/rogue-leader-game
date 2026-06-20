import { Scene, Vector3 } from "@babylonjs/core";
import { getParticleFxPool } from "./particle-fx-pool";

export class ParticleFx {
  static explosion(scene: Scene, position: Vector3): void {
    getParticleFxPool(scene).playExplosion(position);
  }

  static hitSpark(scene: Scene, position: Vector3): void {
    getParticleFxPool(scene).playHitSpark(position);
  }
}
