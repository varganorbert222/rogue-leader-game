import { Scalar, Vector3 } from '@babylonjs/core';
import { radToDeg } from './angles';

export function isNearZero(v: Vector3, epsilon = 1e-6): boolean {
  return v.lengthSquared() < epsilon * epsilon;
}

export function safeNormalize(v: Vector3, fallback = Vector3.Forward()): Vector3 {
  if (isNearZero(v)) return fallback.clone();
  return v.normalize();
}

export function angleBetweenUnitVectors(a: Vector3, b: Vector3): number {
  return Math.acos(Scalar.Clamp(Vector3.Dot(a, b), -1, 1));
}

/** Half-angle (degrees) from axis direction to target position. */
export function angularOffsetDeg(
  axisOrigin: Vector3,
  axisDirection: Vector3,
  targetPos: Vector3,
): number {
  const axis = axisDirection.normalize();
  const toTarget = targetPos.subtract(axisOrigin);
  if (toTarget.lengthSquared() < 1e-6) {
    return 180;
  }
  return radToDeg(angleBetweenUnitVectors(axis, toTarget.normalize()));
}

/** Closest point on segment AB to point P. */
export function closestPointOnSegment(a: Vector3, b: Vector3, p: Vector3): Vector3 {
  const ab = b.clone().subtract(a);
  const lenSq = ab.lengthSquared();
  if (lenSq < 1e-6) return a.clone();
  const t = Scalar.Clamp(Vector3.Dot(p.clone().subtract(a), ab) / lenSq, 0, 1);
  return a.clone().add(ab.scale(t));
}
