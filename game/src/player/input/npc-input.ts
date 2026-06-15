import type { Quaternion, Vector3 } from '@babylonjs/core';
import type { FlockMate } from '../../ai/flock-types';
import type { VehicleInput } from './vehicle-input';

/** World context for NPC steering each tick. */
export interface NpcInputContext {
  /** When false, NPCs ignore the player for radar / combat (same faction). */
  playerIsHostile: boolean;
  playerPosition: Vector3;
  flockMates: FlockMate[];
  flockCenter: Vector3;
  vehiclePosition: Vector3;
  vehicleRotation: Quaternion;
  vehicleSpeed: number;
  cruiseSpeed: number;
  vehicleColliderRadius: number;
}

export interface NpcInputResult {
  vehicle: VehicleInput;
  wantsFire: boolean;
}

/** Produces vehicle axes (and fire intent) for an NPC-controlled craft. */
export interface NpcInput {
  update(dt: number, context: NpcInputContext): NpcInputResult;
}
