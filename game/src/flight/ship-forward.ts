import { Quaternion, Vector3 } from '@babylonjs/core';

/** GLTF ships in this project face +Z; world-space nose direction from rotation. */
export function getShipForward(rotation: Quaternion): Vector3 {
  return Vector3.Forward().applyRotationQuaternion(rotation);
}

export function getShipRight(rotation: Quaternion): Vector3 {
  return Vector3.Right().applyRotationQuaternion(rotation);
}

export function getShipUp(rotation: Quaternion): Vector3 {
  return Vector3.Up().applyRotationQuaternion(rotation);
}

/** Align ship +Z (nose) with world heading (Babylon lookAt uses -Z). */
export function shipRotationFromHeading(heading: Vector3): Quaternion {
  return Quaternion.FromLookDirectionLH(heading.clone().normalize().scale(-1), Vector3.Up());
}
