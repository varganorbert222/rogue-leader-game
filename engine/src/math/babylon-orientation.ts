import { Quaternion, Vector3 } from '@babylonjs/core';

/** Babylon LH camera / ship +Z forward from a world-space direction. */
export function quaternionFromForwardLH(
  forward: Vector3,
  up: Vector3 = Vector3.Up(),
): Quaternion {
  return Quaternion.FromLookDirectionLH(forward.normalize().scale(-1), up);
}

export function quaternionLookAt(
  from: Vector3,
  to: Vector3,
  up: Vector3 = Vector3.Up(),
): Quaternion {
  const dir = to.subtract(from);
  if (dir.lengthSquared() < 1e-8) return Quaternion.Identity();
  return quaternionFromForwardLH(dir, up);
}

/** Align a primitive's +Z axis to `axis` (wireframe segments, cylinders). */
export function quaternionFromAxisLH(
  axis: Vector3,
  up: Vector3 = Vector3.Up(),
): Quaternion {
  return Quaternion.FromLookDirectionLH(axis.normalize(), up);
}
