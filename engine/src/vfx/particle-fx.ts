import {
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';

const FLARE = 'https://assets.babylonjs.com/textures/flare.png';

export class ParticleFx {
  static explosion(scene: Scene, position: Vector3): void {
    const ps = new ParticleSystem('explosion', 120, scene);
    ps.particleTexture = new Texture(FLARE, scene);
    ps.emitter = position.clone();
    ps.minEmitBox = ps.maxEmitBox = Vector3.Zero();
    ps.color1 = new Color4(1, 0.6, 0.1, 1);
    ps.color2 = new Color4(1, 0.2, 0, 0.5);
    ps.minSize = 0.3;
    ps.maxSize = 1.2;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 800;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0, 0);
    ps.manualEmitCount = 120;
    ps.targetStopDuration = 0.5;
    ps.disposeOnStop = true;
    ps.start();
  }

  static hitSpark(scene: Scene, position: Vector3): void {
    const ps = new ParticleSystem('hit', 30, scene);
    ps.particleTexture = new Texture(FLARE, scene);
    ps.emitter = position.clone();
    ps.color1 = new Color4(0.5, 0.8, 1, 1);
    ps.color2 = new Color4(1, 1, 1, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.05;
    ps.maxLifeTime = 0.2;
    ps.emitRate = 200;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.manualEmitCount = 30;
    ps.targetStopDuration = 0.15;
    ps.disposeOnStop = true;
    ps.start();
  }

  static createLaserBolt(scene: Scene, from: Vector3, to: Vector3): Mesh {
    const dir = to.subtract(from);
    const len = dir.length();
    const bolt = MeshBuilder.CreateCylinder(
      'laser',
      { diameter: 0.08, height: len, tessellation: 6 },
      scene
    );
    bolt.position = from.add(to).scale(0.5);
    bolt.lookAt(to);
    bolt.rotation.x += Math.PI / 2;
    const mat = new StandardMaterial('laserMat', scene);
    mat.emissiveColor.set(0.2, 0.8, 1);
    mat.disableLighting = true;
    mat.alpha = 0.9;
    bolt.material = mat;
    setTimeout(() => bolt.dispose(), 80);
    return bolt;
  }

  static engineTrail(scene: Scene, position: Vector3): ParticleSystem {
    const ps = new ParticleSystem('engine', 40, scene);
    ps.particleTexture = new Texture(FLARE, scene);
    ps.emitter = position.clone();
    ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
    ps.color1 = new Color4(0.3, 0.6, 1, 0.8);
    ps.color2 = new Color4(0.1, 0.2, 0.8, 0);
    ps.minSize = 0.15;
    ps.maxSize = 0.5;
    ps.minLifeTime = 0.1;
    ps.maxLifeTime = 0.35;
    ps.emitRate = 80;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.direction1 = new Vector3(-0.2, 0, 0.5);
    ps.direction2 = new Vector3(0.2, 0, 1);
    ps.start();
    return ps;
  }
}
