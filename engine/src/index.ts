export { BabylonHost } from './babylon-host';
export { createGraphicsEngine, type GraphicsBackend } from './backend';
export {
  AudioManager,
  type AudioManifest,
  type LoopTransformOptions,
  type PlayOneShotOptions,
  type StartLoopOptions,
} from './audio/audio-manager';
export type {
  AudioLibraryCategory,
  AudioLibraryDef,
  AudioClipDef,
  MusicSetDef,
  MusicLayerDef,
} from './audio/audio-types';
export { SPEED_OF_SOUND, computeDopplerPitch } from './audio/spatial-audio';
export { SkyboxLoader } from './render/skybox-loader';
export { DebugFloor, type DebugFloorOptions } from './render/debug-floor';
export { DebugAxes, type DebugAxesOptions } from './render/debug-axes';
export { TimeOfDayService } from './render/time-of-day';
export {
  loadAssetManifest,
  type AssetManifest,
  type ShipManifestEntry,
  type ShipFlightStatsManifest,
  type ShipAnchorBindings,
  type ShipAnimationManifest,
  type ShipAnimationTransitionDef,
  type ShipSfoilAbilityManifest,
  type ShipSfoilSfxManifest,
  type ShipAbilitiesManifest,
  type PropManifestEntry,
  type SkyboxManifestEntry,
} from './loaders/asset-manifest';
export {
  detectColliderMeshes,
  configureColliderMesh,
  filterVisualMeshes,
  filterVisualLodMeshes,
} from './loaders/collider-mesh-detector';
export {
  detectShipAnchors,
  getAnchorForward,
  type ShipAnchors,
  type EngineAnchor,
  type WeaponAnchor,
  type WeaponDelivery,
} from './loaders/ship-anchor-detector';
export {
  ModelAxisCorrection,
  applyModelAxisCorrection,
  DEFAULT_SHIP_AXIS_CONFIG,
  axisIdToVector,
  resolveShipAxisConfig,
  resolveShipVisualOptions,
  type AxisId,
  type ShipAxisConventionConfig,
  type ShipVisualOptions,
} from './loaders/ship-axis-convention';
export {
  createEngineTrail,
  updateEngineTrailEmitter,
  DEFAULT_ENGINE_VFX,
  type EngineVfxProfile,
} from './vfx/engine-vfx';
export { GltfShipLoader, type LoadedEntity } from './loaders/gltf-ship-loader';
export {
  refreshLoadedEntityColliders,
  resetLoadedEntityTransform,
  setLoadedEntityVisible,
} from './loaders/loaded-entity-visibility';
export {
  LodShipLoader,
  type LodLoadProgress,
  type LodProgressCallback,
} from './loaders/lod-ship-loader';
export {
  resolveLodPlan,
  defaultScreenThresholds,
  DEFAULT_CULL_SCREEN_PERCENT,
  type LodConfig,
  type LodLevelDef,
  type LodManifestValue,
  type ResolvedLodPlan,
} from './loaders/lod-config';
export {
  createLodRuntimeState,
  updateLodByScreenCoverage,
  type LodRuntimeState,
} from './loaders/lod-runtime';
export { computeScreenCoveragePercent } from './render/screen-coverage';
export { applyMeshAlphaCutoff, disableMeshBackfaceCulling } from './render/mesh-material-utils';
export { detectFirePoints, refreshFirePoints, type FirePoints } from './loaders/firepoint-detector';
export {
  detectWeaponMounts,
  getMountForward,
  type DetectedWeaponMount,
} from './loaders/weapon-mount-detector';
export { TerrainTileLoader } from './loaders/terrain-tile-loader';
export { ParticleFx } from './vfx/particle-fx';
export {
  ParticleFxPool,
  getParticleFxPool,
  disposeParticleFxPool,
} from './vfx/particle-fx-pool';
export { preloadVfxTextures } from './vfx/vfx-textures';
export { ObjectPool } from './pool/object-pool';
export {
  WreckLoader,
  filterDebrisPieceMeshes,
  type WreckTemplate,
} from './loaders/wreck-loader';
export {
  ShipAnimationController,
} from './animation/ship-animation-controller';
export { resolveWreckPath } from './loaders/wreck-path';
