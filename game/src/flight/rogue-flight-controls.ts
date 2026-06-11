import { Vector3, type Quaternion } from "@babylonjs/core";
import { getShipForward, getShipRight, getShipUp } from "./ship-forward";

/**
 * Body-local flight axes (engine space: +X right, +Y up, +Z forward).
 *
 * - Pitch → local +X (right)
 * - Yaw   → local +Y (up)
 * - Roll  → local +Z (forward / nose)
 */
export function computeRogueFlightAxes(shipRotation: Quaternion): {
  pitchAxis: Vector3;
  yawAxis: Vector3;
  rollAxis: Vector3;
} {
  return {
    pitchAxis: getShipRight(shipRotation),
    yawAxis: getShipUp(shipRotation),
    rollAxis: getShipForward(shipRotation),
  };
}

export const ROGUE_PITCH_RATE = 1.8;
export const ROGUE_YAW_RATE = 1.8;
export const ROGUE_ROLL_RATE = 3.0;
