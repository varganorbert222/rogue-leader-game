export { DEBUG_INVINCIBLE, DEBUG_SHOW_AXES } from './debug-flags';
export { KeyboardInput } from './input/keyboard-input';
export { GamepadInput } from './input/gamepad-input';
export { listConnectedGamepads, wakeGamepads, type ConnectedGamepadInfo } from './input/gamepad-list';
export {
  gamepadIdsMatch,
  pickPreferredGamepadSlot,
  isPlayStationGamepad,
  usesStandardGamepadLayout,
} from './input/gamepad-profiles';
export {
  loadFlightPreferences,
  saveFlightPreferences,
  normalizeSelectedGamepadId,
  type FlightPreferences,
} from './settings/flight-preferences';
export { CombinedInput } from './input/combined-input';
export type { IInputSource, FlightInput } from './input/i-input-source';
export type { IPlayerInputSource } from './input/i-player-input-source';
export type { VehicleInput } from './input/vehicle-input';
export type { CombatInput } from './input/combat-input';
export type { CameraInput } from './input/camera-input';
export type { PlayerInput } from './input/player-input';
export {
  playerInputFromFlightInput,
  flightInputFromPlayerInput,
  mergePlayerInputs,
} from './input/player-input';
export type { NpcInput, NpcInputContext, NpcInputResult } from './input/npc-input';
export { Vehicle, type VehicleSpawnOptions } from './vehicles/vehicle';
export type { Actor, ActorRole } from './actors/actor';
export { ActorWorld } from './actors/actor-world';
export { PlayerActor } from './actors/player-actor';
export { NpcActor } from './actors/npc-actor';
/** @deprecated Use Vehicle */
export { PlayerShipController } from './flight/player-ship-controller';
export { CameraController, type CameraMode } from './flight/camera-controller';
export {
  MIN_FLIGHT_SPEED,
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
  YAW_VISUAL_BANK_DEG,
} from './flight/flight-constants';
export { getShipBankAngle } from './flight/flight-assist';
export { getShipForward, shipRotationFromHeading } from './flight/ship-forward';
export { computeRogueFlightAxes } from './flight/rogue-flight-controls';
export {
  DEFAULT_FLIGHT_ASSIST,
  type FlightAssistOptions,
} from './flight/flight-assist';
export { CombatSystem, type ProjectileHit } from './weapons/combat-system';
export type {
  ResolvedWeaponDefinition,
  WeaponDefinition,
  ProjectileWeaponDefinition,
  WeaponDelivery,
  WeaponBehavior,
  WeaponFireGroup,
} from './weapons/core/weapon-definition';
export {
  loadWeaponsManifest,
  type WeaponsManifest,
} from './config/weapons-manifest';
export { VehicleWeaponSystem } from './weapons/core/vehicle-weapon-system';
export { PLAYER_LASER_CANNON } from './weapons/definitions/player-laser-cannon';
export { ENEMY_LASER_CANNON } from './weapons/definitions/enemy-laser-cannon';
export { MissileWeapon } from './weapons/missile-weapon';
export { HarpoonWeapon } from './weapons/harpoon-weapon';
export { HealthComponent } from './entities/health-component';
export { BoidNpcInput, BoidEnemyAI, type EnemyBehavior } from './ai/boid-npc-input';
export { CollisionSystem } from './collision/collision-system';
export { MeteorField } from './hazards/meteor-field';
export {
  MissionManager,
  type MissionHudState,
  type MissionLoadState,
} from './missions/mission-manager';
export type { MissionConfig, MissionEndState } from './missions/mission-types';
export { GameAudioBridge } from './audio/game-audio-bridge';
