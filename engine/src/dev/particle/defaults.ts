import { color4, vec3 } from '../shared/editable-primitives';
import {
  defaultRotationOverLifetime,
  defaultSizeOverLifetime,
} from './curves';
import type {
  ParticleAlbedoTextureEditable,
  ParticleEffectEditable,
  ParticleEmissionEditable,
  ParticleShapeEditable,
  ParticleShapeType,
  ParticleSystemEditable,
} from './types';

export function defaultParticleShape(type: ParticleShapeType = 'box'): ParticleShapeEditable {
  return {
    type,
    direction1: vec3(-1, -1, -1),
    direction2: vec3(1, 1, 1),
    boxMin: vec3(),
    boxMax: vec3(),
    radius: 0.5,
    length: 1,
    tubeRadius: 0.15,
  };
}

export function defaultAlbedoTexture(): ParticleAlbedoTextureEditable {
  return {
    textureId: 'flare',
    isAtlas: false,
    tileWidth: 128,
    tileHeight: 128,
    startCellIndex: 0,
    endCellIndex: 0,
    cellIndex: 0,
    animationSpeed: 1,
    animationLoop: true,
  };
}

export function defaultEmission(): ParticleEmissionEditable {
  return {
    textureId: '',
    color: vec3(1, 1, 1),
  };
}

let particleIdCounter = 0;

export function nextParticleSystemId(): string {
  particleIdCounter += 1;
  return `ps_${particleIdCounter}`;
}

export function defaultParticleSystem(name = 'Particle System'): ParticleSystemEditable {
  return {
    id: nextParticleSystemId(),
    name,
    duration: 5,
    looping: true,
    startDelay: 0,
    capacity: 120,
    minLifeTime: 0.2,
    maxLifeTime: 0.6,
    minSize: 0.3,
    maxSize: 1.2,
    sizeOverLifetime: defaultSizeOverLifetime(),
    minStartSpeedMps: 4,
    maxStartSpeedMps: 10,
    minStartRotationDeg: vec3(),
    maxStartRotationDeg: vec3(),
    minRotationSpeedDeg: vec3(),
    maxRotationSpeedDeg: vec3(),
    rotationOverLifetime: defaultRotationOverLifetime(),
    gravity: vec3(),
    playbackSpeed: 1,
    emissionMode: 'rate',
    emitRate: 200,
    burstCount: 60,
    shape: defaultParticleShape('box'),
    color1: color4(1, 0.6, 0.1, 1),
    color2: color4(1, 0.2, 0, 0.5),
    colorDead: color4(0, 0, 0, 0),
    albedoTexture: defaultAlbedoTexture(),
    emission: defaultEmission(),
    blendMode: 'add',
  };
}

export function defaultParticleEffect(name = 'New Effect'): ParticleEffectEditable {
  return {
    id: `effect_${Date.now()}`,
    name,
    systems: [defaultParticleSystem('Main')],
  };
}
