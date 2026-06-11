import { Quaternion, Scalar, Vector3 } from '@babylonjs/core';
import { ZERO_VEHICLE_INPUT, type VehicleInput } from '../input/vehicle-input';
import { getShipForward, getShipRight, getShipUp } from './ship-forward';

/** Proportional heading error → flight axes; flight angular smoother handles inertia. */
const STEERING_GAIN = 2.35;

/**
 * Map a desired world heading into normalized flight axes (same input model as the player).
 * Uses local pitch/yaw error — no PID, just proportional steering.
 */
export function directionToVehicleInput(
  rotation: Quaternion,
  desiredWorldDir: Vector3,
  speedDelta: number,
  gain = STEERING_GAIN
): VehicleInput {
  const desired = desiredWorldDir.normalize();
  const forward = getShipForward(rotation);
  const right = getShipRight(rotation);
  const up = getShipUp(rotation);

  const yawError = Vector3.Dot(Vector3.Cross(forward, desired), up);
  const pitchError = Vector3.Dot(Vector3.Cross(forward, desired), right);

  return {
    ...ZERO_VEHICLE_INPUT,
    pitch: Scalar.Clamp(pitchError * gain, -1, 1),
    yaw: Scalar.Clamp(yawError * gain, -1, 1),
    throttle: Scalar.Clamp(speedDelta * 0.04, -1, 1),
  };
}

/** @deprecated Use directionToVehicleInput */
export const directionToFlightInput = directionToVehicleInput;
