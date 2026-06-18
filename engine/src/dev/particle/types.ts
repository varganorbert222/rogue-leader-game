import type { Color4Editable, Vec3Editable } from '../shared/editable-primitives';
import type { ParticleNodeTransform } from './transform';
import type { RotationOverLifetimeEditable, SizeOverLifetimeEditable } from './curves';

export type { ParticleNodeTransform };

export type ParticleBlendMode = 'add' | 'alpha' | 'multiply' | 'oneone';
export type ParticleEmissionMode = 'rate' | 'burst';
export type ParticleRenderMode = 'billboard' | 'mesh';

/** When parent particles spawn or die, trigger another module in the same effect. */
export type ParticleSubEmitterTrigger = 'death' | 'birth';

export interface ParticleSubEmitterLink {
  targetSystemId: string;
  trigger: ParticleSubEmitterTrigger;
  /** 0–1 chance per event (1 = always). */
  probability: number;
  inheritVelocity: boolean;
}

export interface ParticleMeshSettings {
  /** URL or path to a GLB used as instanced particle geometry. */
  glbUrl: string;
  uniformScale: number;
  randomRotation: boolean;
}

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
  renderMode: ParticleRenderMode;
  mesh: ParticleMeshSettings;
  subEmitters: ParticleSubEmitterLink[];
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
  /** Alpha test threshold (0–1) for blendMode `alpha`; null = disabled. */
  alphaCutoff: number | null;
}

export type ParticlePresetRefMode = 'readonly' | 'edit';

/** Catalog reference stored in presets.json (no inline config). */
export interface ParticlePresetRef {
  presetId: string;
  systemId: string;
  mode: ParticlePresetRefMode;
}

/**
 * One module in an effect — either inline config (clone) or a catalog reference.
 * Clones store full `config`; references store only `presetRef` + local id/name.
 */
export interface ParticleSystemSlot {
  id: string;
  name: string;
  config?: ParticleSystemEditable;
  presetRef?: ParticlePresetRef;
}

export type ParticleEffectTreeNodeKind = 'group' | 'particleSystem';

export interface ParticleEffectTreeNode {
  id: string;
  name: string;
  kind: ParticleEffectTreeNodeKind;
  children: ParticleEffectTreeNode[];
  transform: ParticleNodeTransform;
  /** Present when kind is `particleSystem`. */
  slot?: ParticleSystemSlot;
}

export interface ParticleEffectEditable {
  id: string;
  name: string;
  /** Normalized flat mirror of module slots in `tree` (runtime). */
  systems: ParticleSystemSlot[];
  tree: ParticleEffectTreeNode[];
}

export interface ParticlePresetEntry {
  id: string;
  label: string;
  effect: ParticleEffectEditable;
}
