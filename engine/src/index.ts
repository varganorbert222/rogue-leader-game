export { BabylonHost } from './core/babylon-host';
export { RuntimePaths, ASSETS_BASE_URL, DATA_BASE_URL } from './runtime-paths';
export type { CockpitConfig, CockpitInputResponseConfig, ResolvedCockpitConfig } from './loaders/cockpit-config';
export {
  DEFAULT_COCKPIT_CONFIG,
  DEFAULT_COCKPIT_FOV_DEG,
  DEFAULT_COCKPIT_INPUT_RESPONSE,
  deriveCockpitModelPath,
  resolveCockpitConfig,
  resolveCockpitModelPath,
  hasShipCockpit,
  suggestCockpitModelPath,
} from './loaders/cockpit-config';
export { createGraphicsEngine, type GraphicsBackend } from './core/backend';
export {
  clamp,
  clampSymmetric,
  clampPitchMultiplier,
  degToRad,
  radToDeg,
  wrapAngleRad,
  lerpAngleRad,
  expSmoothingFactor,
  approachScalar,
  smoothDampedScalar,
  expDecayFactor,
  powSmoothingFactor,
  isNearZero,
  safeNormalize,
  angleBetweenUnitVectors,
  angularOffsetDeg,
  closestPointOnSegment,
  quaternionFromForwardLH,
  quaternionLookAt,
  quaternionFromAxisLH,
  randomInRange,
  randomSign,
  randomUnitVector,
  randomUnitVectorZUp,
  randomPointInSphericalShell,
  randomVector3InRange,
  randomTumbleAxis,
} from './math';
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
export {
  SPEED_OF_SOUND,
  computeDopplerPitch,
  applySpatialMotionToSound,
  type SpatialMotionState,
} from './audio/spatial-audio';
export { SkyboxLoader, type SkyboxApplyOptions } from './render/skybox-loader';
export { DebugFloor, type DebugFloorOptions } from './render/debug-floor';
export { DebugAxes, type DebugAxesOptions } from './render/debug-axes';
export { TimeOfDayService } from './render/time-of-day';
export {
  WireframeLinePool,
} from './render/debug/wireframe-line-pool';
export {
  WireframeShapePool,
} from './render/debug/wireframe-shape-pool';
export {
  LineSegmentCollector,
} from './render/debug/wireframe-primitives';
export {
  ColliderWireframeDebug,
  clearLoadedEntityWireDebugMetadata,
  clearMeshColliderWireDebug,
} from './render/debug/collider-wireframe-debug';
export {
  DebugLabelLayer,
  type DebugLabelSpec,
  type DebugLabelCategory,
} from './render/debug/debug-labels';
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
  type ShipWeaponEnergyManifest,
  type ShipWeaponGroupManifest,
  type ShipWeaponDefinitionPatch,
  type ShipWeaponSlotManifest,
  type ShipWeaponsManifest,
  type PropManifestEntry,
  type SkyboxCubemapEntry,
  type SkyboxManifestEntry,
  type SkyboxPhotodomeEntry,
} from './loaders/asset-manifest';
export {
  detectColliderMeshes,
  configureColliderMesh,
  isVisualColliderMesh,
  hasColliderGeometry,
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
export type { TrailMesh } from '@babylonjs/core/Meshes/trailMesh';
export { GltfShipLoader, type LoadedEntity } from './loaders/gltf-ship-loader';
export {
  preparePropInstanceTemplate,
  spawnPropInstancesFromTemplate,
} from './loaders/prop-instance-spawn';
export { meshLookupKey, meshLookupLeafKey, walkSceneNodes, collectDescendantMeshes, buildMeshLookupMap, mapMeshesByLookupKey } from './loaders/scene-graph-utils';
export {
  prepareLoadedEntityForAcquire,
  prepareLoadedEntityForPool,
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
  defaultDistanceThresholds,
  DEFAULT_CULL_SCREEN_PERCENT,
  DEFAULT_CULL_DISTANCE,
  type LodConfig,
  type LodLevelDef,
  type LodManifestValue,
  type LodMetric,
  type ResolvedLodPlan,
} from './loaders/lod-config';
export {
  createLodRuntimeState,
  updateLod,
  updateLodByScreenCoverage,
  predictActiveLodIndex,
  predictActiveLodIndexByDistance,
  predictActiveLodIndexByScreen,
  predictActiveLodIndexForMetric,
  applyLodVisibility,
  type LodRuntimeState,
} from './loaders/lod-runtime';
export {
  applyBabylonScreenCoverageLod,
  applyBabylonCullOnly,
  prepareLodMeshGroups,
  resolveThresholdsForLevelCount,
  resolveDistanceThresholdsForLevelCount,
} from './loaders/lod-babylon';
export { computeScreenCoveragePercent } from './render/screen-coverage';
export {
  BABYLON_MIN_CAMERA_NEAR_Z,
  CHASE_CAMERA_NEAR_Z,
} from './render/camera-near-plane';
export { computeCameraDistanceMeters } from './render/lod-distance';
export { ensureMeshWorldMatrix, ensureNodeWorldMatrix } from './render/mesh-world-utils';
export { applyMeshAlphaCutoff, disableMeshBackfaceCulling } from './render/mesh-material-utils';
export {
  shareMaterialsFromTemplate,
  optimizeMeshesForRendering,
  optimizeLoadedEntityMeshes,
} from './render/mesh-batching';
export {
  PropInstanceGroup,
} from './render/prop-instance-group';
export {
  LodPreviewScene,
} from './dev/lod-preview-scene';
export {
  CockpitPreviewScene,
  type CockpitPreviewLiveState,
} from './dev/cockpit-preview-scene';
export {
  listLodEditorModels,
} from './dev/lod-manifest-models';
export {
  listCockpitEditorShips,
  cockpitManifestToEditable,
  editableToManifestCockpit,
  defaultCockpitEditable,
  editableToResolvedCockpitConfig,
  type CockpitEditableConfig,
  type CockpitEditableInputResponse,
  type CockpitPreviewMotion,
  previewMotionToVehicleInput,
} from './dev/cockpit-editor-types';
export {
  lodManifestToEditableConfig,
  editableConfigToManifestValue,
  type LodEditorModelEntry,
  type LodEditorModelKind,
  type LodPreviewLiveState,
  type LodPreviewSnapshot,
  type LodPreviewLevelInfo,
} from './dev/lod-editor-types';
export {
  applyCockpitViewMode,
  disposeCockpitAttachment,
  loadCockpitForShip,
  setCockpitVisible,
  setExteriorShipVisible,
  type CockpitAttachment,
} from './loaders/cockpit-loader';
export {
  cockpitInputTargetOffset,
  composeShipVisualRotation,
  computeCockpitPose,
  createCockpitInputOffsetState,
  resetCockpitInputOffsetState,
  updateCockpitInputOffsetState,
  ZERO_COCKPIT_VEHICLE_INPUT,
  type CockpitInputOffsetState,
  type CockpitVehicleInput,
} from './flight/cockpit-camera';
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
export {
  ProjectileMeshPool,
  syncProjectileMeshTransform,
  type PooledProjectileMesh,
} from './vfx/projectile-mesh-pool';
export type { ProjectileVisualConfig } from './vfx/projectile-visual';
