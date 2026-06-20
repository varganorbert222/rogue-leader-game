export {
  loadDebugPreferences,
  saveDebugPreferences,
  cloneDebugPreferences,
  DEFAULT_DEBUG_PREFERENCES,
  type DebugPreferences,
  type DebugOverlayToggles,
  type DebugLabelToggles,
  type DebugGameplayToggles,
} from "./debug/debug-preferences";
export { KeyboardInput } from "./player/input/keyboard-input";
export { GamepadInput } from "./player/input/gamepad-input";
export { BoundPlayerInput } from "./player/input/bound-player-input";
export {
  startBindingCapture,
  type BindingCaptureSession,
} from "./player/input/binding-capture";
export {
  formatBinding,
  formatKeyboardCode,
  formatGamepadButton,
} from "./player/input/binding-labels";
export {
  listConnectedGamepads,
  wakeGamepads,
  type ConnectedGamepadInfo,
} from "./player/input/gamepad-list";
export {
  gamepadIdsMatch,
  pickPreferredGamepadSlot,
  isPlayStationGamepad,
  usesStandardGamepadLayout,
} from "./player/input/gamepad-profiles";
export {
  loadFlightPreferences,
  saveFlightPreferences,
  normalizeSelectedGamepadId,
  type FlightPreferences,
} from "./player/settings/flight-preferences";
export {
  loadControlBindings,
  saveControlBindings,
  resetControlBindings,
  cloneControlBindings,
  DEFAULT_CONTROL_BINDINGS,
  CONTROL_ACTION_LABELS,
  AXIS_ACTION_IDS,
  BUTTON_ACTION_IDS,
  type ControlBindingsConfig,
  type ControlActionId,
  type Binding,
  type AxisActionBindings,
  type ButtonActionBindings,
  type StickSettings,
  type TriggerSettings,
} from "./player/settings/control-bindings";
export {
  applyCapturedBinding,
  isAxisAction,
  isButtonAction,
  removeGamepadButtonBinding,
  removeKeyboardBinding,
  type BindingPole,
} from "./player/settings/control-binding-utils";
export { CombinedInput } from "./player/input/combined-input";
export type { IInputSource, FlightInput } from "./player/input/i-input-source";
export type { IPlayerInputSource } from "./player/input/i-player-input-source";
export type { VehicleInput } from "./player/input/vehicle-input";
export type { CombatInput } from "./player/input/combat-input";
export type { CameraInput } from "./player/input/camera-input";
export type { PlayerInput } from "./player/input/player-input";
export {
  playerInputFromFlightInput,
  flightInputFromPlayerInput,
  mergePlayerInputs,
} from "./player/input/player-input";
export type {
  NpcInput,
  NpcInputContext,
  NpcInputResult,
} from "./player/input/npc-input";
export {
  spawnPlayerEntity,
  spawnNpcEntity,
  replacePlayerShip,
  type ShipSpawnOptions,
} from "./ecs/spawn/entity-factory";
export { World, type SystemFn } from "./ecs/world";
export type { EntityId } from "./ecs/entity-id";
export type { ComponentMap, ComponentKey } from "./ecs/component-map";
export { Role } from "./ecs/components/role-tag";
export { HealthComponent } from "./ecs/components/health-component";
export {
  CameraController,
  type CameraViewMode,
  type CameraDriverKind,
} from "./flight/camera-controller";
export {
  CAMERA_SPRING_PROFILES,
  DEFAULT_CAMERA_SPRING_PROFILE,
  cycleCameraSpringProfile,
  type CameraSpringProfile,
  type CameraSpringProfileId,
} from "./flight/camera-profile";
export {
  FollowCameraDriver,
  ScriptedCameraDriver,
  RailCameraDriver,
  type CameraSequence,
  type CameraSequenceKeyframe,
} from "./flight/camera-drivers";
export {
  MIN_FLIGHT_SPEED,
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
  YAW_VISUAL_BANK_DEG,
} from "./flight/flight-constants";
export { getShipBankAngle } from "./flight/flight-assist";
export { getShipForward, shipRotationFromHeading } from "./flight/ship-forward";
export { computeRogueFlightAxes } from "./flight/rogue-flight-controls";
export {
  DEFAULT_FLIGHT_ASSIST,
  type FlightAssistOptions,
} from "./flight/flight-assist";
export { CombatSystem, type ProjectileHit } from "./combat/systems/combat-system";
export type {
  ResolvedWeaponDefinition,
  WeaponDelivery,
  WeaponBehavior,
  WeaponFireGroup,
} from "./combat/weapons/weapon-definition";
export {
  loadWeaponsManifest,
  type WeaponsManifest,
} from "./config/loaders/weapons-manifest";
export { VehicleWeaponSystem } from "./combat/weapons/vehicle-weapon-system";
export { BoidNpcInput, type EnemyBehavior } from "./ai/boid-npc-input";
export { BehaviorNpcInput } from "./ai/behavior-npc-input";
export { NpcStateMachine } from "./ai/npc-state-machine";
export { RadarSystem } from "./combat/targeting/radar-system";
export { updateWeaponAimForObserver } from "./combat/targeting/weapon-aim-controller";
export {
  loadNpcBehaviorConfig,
  DEFAULT_NPC_BEHAVIOR_CONFIG,
  type NpcBehaviorConfig,
  type NpcStateId,
} from "./config/loaders/npc-behavior-config";
export { GameDebugOverlay } from "./debug/game-debug-overlay";
export { CollisionSystem, buildSphereBody } from "./collision/collision-system";
export {
  AsteroidSpawnService,
  type AsteroidConfig,
} from "./hazards/asteroid-spawn-service";
/** @deprecated Use {@link AsteroidSpawnService}. */
export { AsteroidSpawnService as AsteroidField } from "./hazards/asteroid-spawn-service";
export { MissionManager } from "./mission/session/mission-manager";
export { MissionBootstrap } from "./mission/bootstrap/mission-bootstrap";
export { MissionSimulationCoordinator } from "./simulation/coordinator/mission-simulation-coordinator";
export type { MissionRuntimeContext } from "./simulation/runtime-context";
export type { MissionHudState, MissionLoadState } from "./mission/presentation/mission-hud-state";
export type { MissionConfig, MissionEndState, MissionSessionPhase } from "./mission/mission-types";
export { MissionEndStates } from "./mission/mission-types";
export type { SelectableShipInfo } from "./mission/spawn/selectable-ships";
export type { MissionSpawnPolicy } from "./mission/spawn/mission-spawn-policy";
export {
  SfxClipIds,
  MusicTrackIds,
  UiSfxClipIds,
  ShipIds,
  DEFAULT_PLAYER_SHIP_ID,
  MissionIds,
  DEFAULT_MISSION_ID,
  WinConditionTypes,
  EntityDestroyKinds,
  ProjectileBehaviors,
  AmmoIds,
  CombatTeams,
  ActorRoles,
  Factions,
  DamageSeverities,
  isMissileHitBehavior,
  type SfxClipId,
  type MusicTrackId,
  type UiSfxClipId,
  type ShipId,
  type MissionId,
  type EntityDestroyKind,
  type DamageSeverity,
} from "./config/constants";
export {
  GameEventTypes,
  GameEventPayloadKeys,
  GameEvents,
  GameEventBus,
  type GameEventType,
  type GameEvent,
} from "./core/events/game-events";
export { ShipAudioCatalog } from "./audio/ship-audio-map";
export {
  ShipEngineAudioManager,
  type ShipEngineAudioSource,
} from "./audio/ship-engine-audio";
export { WeaponHitSfxResolver } from "./audio/weapon-hit-sfx";
export {
  GameAudioBridge,
  type GameAudioUpdateContext,
} from "./audio/game-audio-bridge";
export { CombatIntensityTracker } from "./audio/combat-intensity";
