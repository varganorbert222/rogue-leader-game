import { Vector3 } from '@babylonjs/core';
import { angularOffsetDeg } from '@rogue-leader/engine';

/** True when the target lies inside the aim cone (half-angle from axis). */
export function isInsideAimCone(
  axisOrigin: Vector3,
  axisDirection: Vector3,
  targetPos: Vector3,
  halfAngleDeg: number,
): boolean {
  return angularOffsetDeg(axisOrigin, axisDirection, targetPos) <= halfAngleDeg;
}
