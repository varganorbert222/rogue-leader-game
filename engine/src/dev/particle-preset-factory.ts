import { Color4, ParticleSystem, Vector3, type Scene } from '@babylonjs/core';
import { getFlareTexture } from '../vfx/vfx-textures';
import type {
  Color4Editable,
  ParticleBlendMode,
  ParticleSystemEditable,
  Vec3Editable,
} from './particle-editor-types';

function toColor4(c: Color4Editable): Color4 {
  return new Color4(c.r, c.g, c.b, c.a);
}

function toVector3(v: Vec3Editable): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

function resolveBlendMode(mode: ParticleBlendMode): number {
  switch (mode) {
    case 'standard':
      return ParticleSystem.BLENDMODE_STANDARD;
    case 'multiply':
      return ParticleSystem.BLENDMODE_MULTIPLY;
    case 'oneone':
      return ParticleSystem.BLENDMODE_ONEONE;
    case 'add':
    default:
      return ParticleSystem.BLENDMODE_ADD;
  }
}

export function applyEditableToParticleSystem(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  scene: Scene,
): void {
  ps.name = config.name;

  if (config.texture === 'flare') {
    ps.particleTexture = getFlareTexture(scene);
  } else {
    ps.particleTexture = null;
  }

  ps.minEmitBox = toVector3(config.minEmitBox);
  ps.maxEmitBox = toVector3(config.maxEmitBox);
  ps.color1 = toColor4(config.color1);
  ps.color2 = toColor4(config.color2);
  ps.colorDead = toColor4(config.colorDead);
  ps.minSize = config.minSize;
  ps.maxSize = config.maxSize;
  ps.minLifeTime = config.minLifeTime;
  ps.maxLifeTime = config.maxLifeTime;
  ps.emitRate = config.emitRate;
  ps.targetStopDuration = config.targetStopDuration;
  ps.blendMode = resolveBlendMode(config.blendMode);
  ps.direction1 = toVector3(config.direction1);
  ps.direction2 = toVector3(config.direction2);
  ps.gravity = toVector3(config.gravity);
  ps.minAngularSpeed = config.minAngularSpeed;
  ps.maxAngularSpeed = config.maxAngularSpeed;
  ps.minEmitPower = config.minEmitPower;
  ps.maxEmitPower = config.maxEmitPower;
  ps.updateSpeed = config.updateSpeed;
  ps.startDelay = config.startDelay;
  ps.disposeOnStop = config.disposeOnStop;
}

export function createParticleSystemFromEditable(
  scene: Scene,
  config: ParticleSystemEditable,
): ParticleSystem {
  const ps = new ParticleSystem(config.name, config.capacity, scene);
  applyEditableToParticleSystem(ps, config, scene);
  return ps;
}

export function readEditableFromParticleSystem(
  ps: ParticleSystem,
  id: string,
): ParticleSystemEditable {
  const blendMode: ParticleBlendMode =
    ps.blendMode === ParticleSystem.BLENDMODE_STANDARD
      ? 'standard'
      : ps.blendMode === ParticleSystem.BLENDMODE_MULTIPLY
        ? 'multiply'
        : ps.blendMode === ParticleSystem.BLENDMODE_ONEONE
          ? 'oneone'
          : 'add';

  return {
    id,
    name: ps.name,
    capacity: ps.getCapacity(),
    texture: ps.particleTexture ? 'flare' : 'none',
    playMode: 'loop',
    minEmitBox: { x: ps.minEmitBox.x, y: ps.minEmitBox.y, z: ps.minEmitBox.z },
    maxEmitBox: { x: ps.maxEmitBox.x, y: ps.maxEmitBox.y, z: ps.maxEmitBox.z },
    color1: { r: ps.color1.r, g: ps.color1.g, b: ps.color1.b, a: ps.color1.a },
    color2: { r: ps.color2.r, g: ps.color2.g, b: ps.color2.b, a: ps.color2.a },
    colorDead: {
      r: ps.colorDead.r,
      g: ps.colorDead.g,
      b: ps.colorDead.b,
      a: ps.colorDead.a,
    },
    minSize: ps.minSize,
    maxSize: ps.maxSize,
    minLifeTime: ps.minLifeTime,
    maxLifeTime: ps.maxLifeTime,
    emitRate: ps.emitRate,
    manualEmitCount: 0,
    targetStopDuration: ps.targetStopDuration,
    blendMode,
    direction1: { x: ps.direction1.x, y: ps.direction1.y, z: ps.direction1.z },
    direction2: { x: ps.direction2.x, y: ps.direction2.y, z: ps.direction2.z },
    gravity: { x: ps.gravity.x, y: ps.gravity.y, z: ps.gravity.z },
    minAngularSpeed: ps.minAngularSpeed,
    maxAngularSpeed: ps.maxAngularSpeed,
    minEmitPower: ps.minEmitPower,
    maxEmitPower: ps.maxEmitPower,
    updateSpeed: ps.updateSpeed,
    startDelay: ps.startDelay,
    disposeOnStop: ps.disposeOnStop,
  };
}
