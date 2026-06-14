import { Quaternion, Scalar, Vector3, type TransformNode } from '@babylonjs/core';
import { expSmoothingFactor, quaternionFromForwardLH } from '@rogue-leader/engine';

export interface SoftBoundary {
  center: Vector3;
  radius: number;
}

/**
 * Steers the ship back toward the play volume when outside the soft boundary.
 * Uses non-mutating vector math — never subtract in place from world position.
 */
export function applySoftBoundary(
  root: TransformNode,
  boundary: SoftBoundary,
  dt: number
): void {
  const offset = root.position.clone().subtract(boundary.center);
  const dist = offset.length();
  if (dist <= boundary.radius) return;

  const overshootRatio = (dist - boundary.radius) / boundary.radius;
  const toCenter = boundary.center.clone().subtract(root.position).normalize();

  const rot = root.rotationQuaternion ?? Quaternion.Identity();
  const targetRot = quaternionFromForwardLH(toCenter);
  const steerRate = Scalar.Clamp(2 + overshootRatio * 6, 2, 10);
  root.rotationQuaternion = Quaternion.Slerp(
    rot,
    targetRot,
    expSmoothingFactor(steerRate, dt),
  ).normalize();

  const pull = offset.normalize().scale(-(dist - boundary.radius) * 6 * dt);
  root.position.addInPlace(pull);

  const afterOffset = root.position.clone().subtract(boundary.center);
  const afterDist = afterOffset.length();
  if (afterDist > boundary.radius) {
    afterOffset.normalize().scale(boundary.radius * 0.995);
    root.position.copyFrom(boundary.center.clone().add(afterOffset));
  }
}
