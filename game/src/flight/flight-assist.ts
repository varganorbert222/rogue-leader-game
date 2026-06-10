import { Quaternion, Scalar, Vector3 } from '@babylonjs/core';
import { getShipForward, getShipRight, getShipUp } from './ship-forward';

/** Signed bank relative to world horizon (radians). Positive = right wing down. */
export function getShipBankAngle(rotation: Quaternion): number {
  const right = getShipRight(rotation);
  return Math.atan2(-right.y, Math.hypot(right.x, right.z));
}

export interface FlightAssistOptions {
  autoRoll: boolean;
}

export const DEFAULT_FLIGHT_ASSIST: FlightAssistOptions = {
  autoRoll: true,
};

export const INPUT_DEADZONE = 0.06;

/** Seconds without roll input before auto-roll begins. */
export const ROLL_IDLE_DELAY_SEC = 3;

/** Slerp speed toward wings-level orientation. */
export const AUTO_ROLL_RATE = 4;

/**
 * Orientation with the same nose direction but zero bank relative to world up.
 * Pitch and yaw (forward vector) are preserved; only roll is removed.
 */
export function computeLevelRotation(forward: Vector3, fallback: Quaternion): Quaternion {
  const fwd = forward.clone().normalize();
  const worldUp = Vector3.Up();
  let right = Vector3.Cross(worldUp, fwd);
  if (right.lengthSquared() < 1e-4) {
    return fallback.clone();
  }
  right.normalize();
  const up = Vector3.Cross(fwd, right).normalize();
  return Quaternion.FromLookDirectionLH(fwd.negate(), up);
}

export function getRollMisalignment(rotation: Quaternion): number {
  const fwd = getShipForward(rotation);
  const target = computeLevelRotation(fwd, rotation);
  const shipUp = getShipUp(rotation);
  const targetUp = getShipUp(target);
  return Math.acos(Scalar.Clamp(Vector3.Dot(shipUp, targetUp), -1, 1));
}

export function applyAutoRoll(rotation: Quaternion, dt: number): Quaternion {
  const fwd = getShipForward(rotation);
  const target = computeLevelRotation(fwd, rotation);
  if (getRollMisalignment(rotation) < 0.002) {
    return rotation;
  }

  const t = 1 - Math.exp(-AUTO_ROLL_RATE * dt);
  return Quaternion.Slerp(rotation, target, t).normalize();
}
