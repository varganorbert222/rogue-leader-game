import type { Color4Editable, Vec3Editable } from '../shared/editable-primitives';
import type { RotationOverLifetimeEditable, SizeOverLifetimeEditable } from './curves';

export type ParticleBlendMode = 'add' | 'alpha' | 'multiply' | 'oneone';
export type ParticleEmissionMode = 'rate' | 'burst';

export type ParticleShapeType =
  | 'point'
  | 'line'
  | 'box'
  | 'sphere'
  | 'hemisphere'
  | 'capsule'
  | 'donut';

export interface ParticleShapeEditable {
  type: ParticleShapeType;
  direction1: Vec3Editable;
  direction2: Vec3Editable;
  boxMin: Vec3Editable;
  boxMax: Vec3Editable;
  radius: number;
  length: number;
  tubeRadius: number;
}

export interface ParticleAlbedoTextureEditable {
  textureId: string;
  isAtlas: boolean;
  tileWidth: number;
  tileHeight: number;
  startCellIndex: number;
  endCellIndex: number;
  cellIndex: number;
  animationSpeed: number;
  animationLoop: boolean;
}

export interface ParticleEmissionEditable {
  textureId: string;
  color: Vec3Editable;
}

export interface ParticleSystemEditable {
  id: string;
  name: string;
  duration: number;
  looping: boolean;
  startDelay: number;
  capacity: number;
  minLifeTime: number;
  maxLifeTime: number;
  minSize: number;
  maxSize: number;
  sizeOverLifetime: SizeOverLifetimeEditable;
  minStartSpeedMps: number;
  maxStartSpeedMps: number;
  minStartRotationDeg: Vec3Editable;
  maxStartRotationDeg: Vec3Editable;
  minRotationSpeedDeg: Vec3Editable;
  maxRotationSpeedDeg: Vec3Editable;
  rotationOverLifetime: RotationOverLifetimeEditable;
  gravity: Vec3Editable;
  playbackSpeed: number;
  emissionMode: ParticleEmissionMode;
  emitRate: number;
  burstCount: number;
  shape: ParticleShapeEditable;
  color1: Color4Editable;
  color2: Color4Editable;
  colorDead: Color4Editable;
  albedoTexture: ParticleAlbedoTextureEditable;
  emission: ParticleEmissionEditable;
  blendMode: ParticleBlendMode;
}

export interface ParticleEffectEditable {
  id: string;
  name: string;
  systems: ParticleSystemEditable[];
}

export interface ParticlePresetEntry {
  id: string;
  label: string;
  effect: ParticleEffectEditable;
}
