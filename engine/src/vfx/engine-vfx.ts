import {
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
  type TransformNode,
} from '@babylonjs/core';

const FLARE = 'https://assets.babylonjs.com/textures/flare.png';

export interface EngineVfxProfile {
  emitRate: number;
  color1: [number, number, number, number];
  color2: [number, number, number, number];
  minSize: number;
  maxSize: number;
  minLifeTime?: number;
  maxLifeTime?: number;
  blendMode?: 'add' | 'standard';
  bloom?: boolean;
  direction1?: [number, number, number];
  direction2?: [number, number, number];
}

export const DEFAULT_ENGINE_VFX: EngineVfxProfile = {
  emitRate: 80,
  color1: [0.3, 0.6, 1, 0.8],
  color2: [0.1, 0.2, 0.8, 0],
  minSize: 0.15,
  maxSize: 0.5,
  minLifeTime: 0.1,
  maxLifeTime: 0.35,
  blendMode: 'add',
  bloom: false,
  direction1: [-0.2, 0, 0.5],
  direction2: [0.2, 0, 1],
};

export function createEngineTrail(
  scene: Scene,
  anchor: TransformNode,
  profile: EngineVfxProfile = DEFAULT_ENGINE_VFX
): ParticleSystem {
  const ps = new ParticleSystem(`engine_${anchor.name}`, 40, scene);
  ps.particleTexture = new Texture(FLARE, scene);
  ps.emitter = anchor.getAbsolutePosition().clone();
  ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
  ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  ps.color1 = new Color4(...profile.color1);
  ps.color2 = new Color4(...profile.color2);
  ps.minSize = profile.minSize;
  ps.maxSize = profile.maxSize;
  ps.minLifeTime = profile.minLifeTime ?? 0.1;
  ps.maxLifeTime = profile.maxLifeTime ?? 0.35;
  ps.emitRate = profile.emitRate;
  ps.blendMode =
    profile.blendMode === 'standard'
      ? ParticleSystem.BLENDMODE_ONEONE
      : ParticleSystem.BLENDMODE_ADD;
  const d1 = profile.direction1 ?? [-0.2, 0, 0.5];
  const d2 = profile.direction2 ?? [0.2, 0, 1];
  ps.direction1 = new Vector3(d1[0], d1[1], d1[2]);
  ps.direction2 = new Vector3(d2[0], d2[1], d2[2]);
  ps.start();
  return ps;
}

export function updateEngineTrailEmitter(trail: ParticleSystem, anchor: TransformNode): void {
  trail.emitter = anchor.getAbsolutePosition().clone();
}
