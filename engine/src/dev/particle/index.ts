// Domain model
export type {
  ParticleBlendMode,
  ParticleEmissionMode,
  ParticleShapeType,
  ParticleShapeEditable,
  ParticleAlbedoTextureEditable,
  ParticleEmissionEditable,
  ParticleSystemEditable,
  ParticleEffectEditable,
  ParticlePresetEntry,
} from './types';

// Shared primitives (re-exported for editor consumers)
export type { Vec3Editable, Color4Editable } from '../shared/editable-primitives';
export { vec3, color4 } from '../shared/editable-primitives';

// Lifetime curves
export type {
  SizeOverLifetimeEditable,
  SizeOverLifetimeMode,
  RotationOverLifetimeEditable,
  RotationOverLifetimeMode,
  CurveKeyframeEditable,
  CurvePreset,
  Vec3CurveKeyframeEditable,
  Vec3CurvePreset,
} from './curves';
export {
  SIZE_OVER_LIFETIME_PRESETS,
  ROTATION_OVER_LIFETIME_PRESETS,
  getSizeOverLifetimePreset,
  getRotationOverLifetimePreset,
  defaultSizeOverLifetime,
  defaultRotationOverLifetime,
  normalizeSizeOverLifetime,
  normalizeRotationOverLifetime,
  normalizeCurveKeyframes,
  cloneCurveKeyframes,
  cloneVec3CurveKeyframes,
} from './curves';

// Defaults & normalization
export {
  defaultParticleShape,
  defaultAlbedoTexture,
  defaultEmission,
  defaultParticleSystem,
  defaultParticleEffect,
  nextParticleSystemId,
} from './defaults';
export {
  normalizeParticleSystem,
  normalizeParticleEffect,
  cloneParticleEffect,
} from './normalize';

// Atlas helpers
export {
  atlasFrameCount,
  isAnimatedParticleAtlas,
  syncStaticAtlasCell,
} from './albedo-atlas';

// Hierarchy
export { buildParticleEffectHierarchy } from './hierarchy';

// Babylon apply pipeline
export {
  applyEditableToParticleSystem,
  createParticleSystemFromEditable,
} from './apply/factory';
export { applyParticleShape } from './apply/shape';
export { applySizeOverLifetime } from './apply/size-lifetime';
export { applyRotationOverLifetime } from './apply/rotation-lifetime';

// Playback
export {
  startParticlePlayback,
  applyEmissionDuration,
  burstReleaseMs,
  loopCycleDurationMs,
  estimateSystemPreviewDurationMs,
  estimateEffectPreviewDurationMs,
} from './playback';

// Units
export {
  BABYLON_PARTICLE_UPDATE_BASE,
  PARTICLE_SPEED_REFERENCE_FPS,
  mpsToEmitPower,
  emitPowerToMps,
  babylonUpdateSpeed,
} from './units';

// Textures
export {
  loadParticleTextureCatalog,
  listParticleTextures,
  resolveAlbedoTextureUrl,
  resolveParticleTextureUrlById,
  particleTextureAssetUrl,
  PARTICLE_TEXTURES_DIR,
  countAtlasCells,
  atlasCellColumn,
  atlasCellRow,
  getParticleTextureEntry,
  syncAlbedoTextureFromCatalog,
  type ParticleTextureEntry,
  type ParticleTextureAtlasConfig,
} from './textures/catalog';

// Presets
export {
  loadParticlePresets,
  getBuiltinParticlePresets,
  newBlankParticlePreset,
} from './presets';

// Preview scene
export { ParticlePreviewScene } from './preview-scene';
