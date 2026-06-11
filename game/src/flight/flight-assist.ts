import { Quaternion, Vector3 } from "@babylonjs/core";
import { getShipForward, getShipRight, getShipUp } from "./ship-forward";

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

/** Seconds without pitch/roll/yaw input before auto-roll begins. */
export const ROLL_IDLE_DELAY_SEC = 1;

export function hasFlightControlInput(input: {
  pitch: number;
  roll: number;
  yaw: number;
}): boolean {
  return (
    Math.abs(input.pitch) >= INPUT_DEADZONE ||
    Math.abs(input.roll) >= INPUT_DEADZONE ||
    Math.abs(input.yaw) >= INPUT_DEADZONE
  );
}

/** Max angular speed (radians/sec) for auto-roll correction. */
export const AUTO_ROLL_RATE = 1.5;

/**
 * When |forward.y| exceeds this, roll vs yaw is undefined (nose near vertical).
 * Auto-roll is paused until the nose leaves this cone.
 */
export const AUTO_ROLL_VERTICAL_CUTOFF = 0.88;

export function canAutoRoll(rotation: Quaternion): boolean {
  return Math.abs(getShipForward(rotation).y) < AUTO_ROLL_VERTICAL_CUTOFF;
}

/** Level wings for the current nose direction (unique when not near vertical). */
function computeLevelUp(forward: Vector3): Vector3 | null {
  const fwd = forward.clone().normalize();
  let right = Vector3.Cross(Vector3.Up(), fwd);
  if (right.lengthSquared() < 1e-4) {
    return null;
  }
  right.normalize();
  return Vector3.Cross(fwd, right).normalize();
}

/**
 * Shortest signed roll (radians) around nose to align ship up with level wings.
 * Always in [-π, π] — the smaller arc back to horizontal.
 */
export function getShortestRollToLevelAngle(rotation: Quaternion): number {
  const fwd = getShipForward(rotation);
  const targetUp = computeLevelUp(fwd);
  if (!targetUp) {
    return 0;
  }

  const shipUp = getShipUp(rotation);
  const sin = Vector3.Dot(Vector3.Cross(shipUp, targetUp), fwd);
  const cos = Vector3.Dot(shipUp, targetUp);
  return Math.atan2(sin, cos);
}

/**
 * Removes wing bank via the shortest rotation around the nose axis.
 */
export function applyAutoRoll(rotation: Quaternion, dt: number): Quaternion {
  if (!canAutoRoll(rotation)) {
    return rotation;
  }

  const rollAngle = getShortestRollToLevelAngle(rotation);
  if (Math.abs(rollAngle) < 0.002) {
    return rotation;
  }

  const fwd = getShipForward(rotation);
  // Apply a capped angular step towards level to make the correction
  // feel smooth and uniform regardless of how large the initial bank is.
  const maxStep = AUTO_ROLL_RATE * dt; // radians per frame cap
  const step = Math.abs(rollAngle) <= maxStep ? rollAngle : Math.sign(rollAngle) * maxStep;
  const correction = Quaternion.RotationAxis(fwd, step);
  return correction.multiply(rotation).normalize();
}
