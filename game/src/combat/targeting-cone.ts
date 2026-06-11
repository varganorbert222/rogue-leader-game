import { Scalar, Vector3 } from '@babylonjs/core';

/** Half-angle (degrees) from the aim axis to the target direction. */
export function angularOffsetDeg(
  axisOrigin: Vector3,
  axisDirection: Vector3,
  targetPos: Vector3
): number {
  const axis = axisDirection.normalize();
  const toTarget = targetPos.subtract(axisOrigin);
  if (toTarget.lengthSquared() < 1e-6) {
    return 180;
  }
  const dot = Scalar.Clamp(Vector3.Dot(axis, toTarget.normalize()), -1, 1);
  return (Math.acos(dot) * 180) / Math.PI;
}

/** True when the target lies inside the aim cone (half-angle from axis). */
export function isInsideAimCone(
  axisOrigin: Vector3,
  axisDirection: Vector3,
  targetPos: Vector3,
  halfAngleDeg: number
): boolean {
  return angularOffsetDeg(axisOrigin, axisDirection, targetPos) <= halfAngleDeg;
}
