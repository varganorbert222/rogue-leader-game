import { Quaternion, Vector3 } from '@babylonjs/core';
import { isNearZero } from '@rogue-leader/engine';
import type { NpcStateId } from '../data/config/npc-behavior-config';
import { directionToVehicleInput } from '../flight/flight-steering';
import { getShipForward } from '../flight/ship-forward';
import type { VehicleInput } from '../player/input/vehicle-input';
import type { EnemyBehavior } from './enemy-behavior';

export interface DirectionToTarget {
  direction: Vector3;
  distance: number;
}

export interface FlockSteeringWeights {
  separation: number;
  alignment: number;
  cohesion: number;
  playerChase: number;
}

/** World direction toward a target with ship-forward fallback at zero range. */
export function computeDirectionToTarget(
  from: Vector3,
  to: Vector3,
  fallbackForward: Vector3,
): DirectionToTarget {
  const offset = to.subtract(from);
  const distance = offset.length();
  const direction = distance > 0.01 ? offset.normalize() : fallbackForward.clone();
  return { direction, distance };
}

/** Blend toward target with a horizontal flank offset (world Y up). */
export function flankSteeringDirection(
  towardTarget: Vector3,
  flankSide: number,
  blendStrength: number,
  worldUp: Vector3 = Vector3.Up(),
): Vector3 {
  const right = Vector3.Cross(worldUp, towardTarget).normalize();
  return towardTarget.add(right.scale(flankSide * blendStrength)).normalize();
}

export function normalizeSteerDirection(dir: Vector3, fallback: Vector3): Vector3 {
  if (isNearZero(dir, 1e-4)) return fallback.clone();
  return dir.normalize();
}

export function blendFlockSteering(
  primary: Vector3,
  separation: Vector3,
  alignment: Vector3,
  cohesion: Vector3,
  playerDir: Vector3,
  weights: FlockSteeringWeights,
): Vector3 {
  return primary
    .clone()
    .add(separation.scale(weights.separation))
    .add(alignment.scale(weights.alignment))
    .add(cohesion.scale(weights.cohesion))
    .add(playerDir.scale(weights.playerChase));
}

export function computeEnemyApproachDirection(
  behavior: EnemyBehavior,
  playerDir: Vector3,
  playerDist: number,
  flankSide: number,
  mode: 'defensive' | 'flock' | 'combat',
  combatState?: NpcStateId,
): Vector3 {
  if (behavior === 'flank') {
    const minDist = mode === 'flock' ? 80 : 60;
    if (playerDist > minDist) {
      const strength =
        mode === 'defensive' ? 0.6 : mode === 'flock' ? 0.35 : combatState === 'attack' ? 0.5 : 0.35;
      return flankSteeringDirection(playerDir, flankSide, strength);
    }
    return playerDir.clone();
  }

  if (behavior === 'chase' || combatState === 'chase') {
    return playerDir.clone();
  }

  if (mode === 'combat' && behavior === 'attack') {
    return playerDir.scale(combatState === 'attack' ? 1 : 0.85).normalize();
  }

  if (mode === 'flock') {
    return playerDir.scale(0.85).add(Vector3.Up().scale(0.05)).normalize();
  }

  return playerDir.clone();
}

/** Map a world steering direction to vehicle input with alignment-based speed. */
export function steeringToVehicleInput(
  rotation: Quaternion,
  steerDir: Vector3,
  cruiseSpeed: number,
  currentSpeed: number,
  speedFactor = 1,
): VehicleInput {
  const alignment = Vector3.Dot(getShipForward(rotation), steerDir);
  const targetSpeed = cruiseSpeed * speedFactor * (0.7 + alignment * 0.3);
  return directionToVehicleInput(rotation, steerDir, targetSpeed - currentSpeed);
}
