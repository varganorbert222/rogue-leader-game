// Domain model
export type {
  ParticleBlendMode,
  ParticleEmissionMode,
  ParticleRenderMode,
  ParticleSubEmitterTrigger,
  ParticleSubEmitterLink,
  ParticleMeshSettings,
  ParticleShapeType,
  ParticleShapeEditable,
  ParticleAlbedoTextureEditable,
  ParticleEmissionEditable,
  ParticleSystemEditable,
  ParticleEffectEditable,
  ParticlePresetEntry,
  ParticleEffectTreeNode,
  ParticleEffectTreeNodeKind,
  ParticleNodeTransform,
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
  defaultMeshSettings,
  defaultParticleSystem,
  defaultParticleEffect,
  nextParticleSystemId,
} from './defaults';
export {
  normalizeParticleSystem,
} from './system-normalize';
export {
  normalizeParticleEffect,
  cloneParticleEffect,
} from './normalize';

// Atlas helpers
export {
  atlasFrameCount,
  isAnimatedParticleAtlas,
  syncStaticAtlasCell,
} from './albedo-atlas';

// Preset references (Unity-style prefab reuse)
export type {
  ParticlePresetRefMode,
  ParticlePresetRef,
  ParticleSystemSlot,
} from './types';
export {
  isParticlePresetRef,
  isParticleSystemSlot,
  normalizeParticleSystemSlot,
  serializeParticleSystemSlot,
  serializeParticleEffect,
  serializeParticlePreset,
  resolveParticleSystemSlot,
  resolveParticleEffect,
  findSlotById,
  isSlotReadonlyRef,
  isSlotEditRef,
  createInlineSlot,
  createPresetRefSlot,
  cloneSlotAsInstance,
  listCatalogSystemOptions,
  writeEditRefToCatalog,
  setSlotRefMode,
  type CatalogSystemOption,
} from './refs';

// Effect tree (hierarchy authoring)
export {
  createGroupNode,
  createModuleTreeNode,
  systemsToTree,
  flattenEffectSlots,
  countParticleModules,
  walkTree,
  findTreeNode,
  findSlotInEffect,
  findModuleTreeNode,
  insertNodeAsLastChild,
  insertNodeUnderAnchor,
  removeTreeNode,
  isTreeDescendant,
  moveTreeNode,
  normalizeTreeNode,
  normalizeEffectTree,
  syncEffectSystemsFromTree,
  cloneEffectTree,
  cloneTreeNodeSubtree,
  buildReferencedPresetTree,
  buildClonedPresetTree,
  serializeEffectTree,
  remapTreeIds,
  type TreeLocateResult,
} from './tree';

export {
  defaultNodeTransform,
  normalizeNodeTransform,
  ensureTreeNodeTransform,
  copyNodeTransform,
  applyTransformToBabylonNode,
} from './transform';

// Hierarchy
export { buildParticleEffectHierarchy } from './hierarchy';

// Babylon apply pipeline
export {
  applyEditableToParticleSystem,
  createParticleSystemFromEditable,
} from './apply/factory';
export { applyParticleShape } from './apply/shape';
export {
  applySubEmittersToParticleSystem,
  collectSubEmitterTargetIds,
} from './apply/sub-emitters';
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
