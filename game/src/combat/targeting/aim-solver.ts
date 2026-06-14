import { Matrix, Quaternion, Vector3 } from '@babylonjs/core';
import {
  angleBetweenUnitVectors,
  clamp,
  isNearZero,
  safeNormalize,
} from '@rogue-leader/engine';

/** Slerp between unit directions with a max angular step (rad). */
export function rotateTowardDirection(
  current: Vector3,
  desired: Vector3,
  maxAngleRad: number,
): Vector3 {
  const from = safeNormalize(current, Vector3.Forward());
  const to = safeNormalize(desired, from);
  const angle = angleBetweenUnitVectors(from, to);
  if (angle < 1e-6) {
    return to.clone();
  }
  const t = Math.min(1, maxAngleRad / angle);
  const sinAngle = Math.sin(angle);
  const w1 = Math.sin((1 - t) * angle) / sinAngle;
  const w2 = Math.sin(t * angle) / sinAngle;
  return from.scale(w1).add(to.scale(w2)).normalize();
}

/** True when the target lies in the forward hemisphere of the aim axis. */
export function isTargetInAimHemisphere(
  axisOrigin: Vector3,
  axisDirection: Vector3,
  targetPos: Vector3,
  minDot = 0,
): boolean {
  const axis = axisDirection.normalize();
  const toTarget = targetPos.subtract(axisOrigin);
  if (isNearZero(toTarget)) {
    return false;
  }
  return Vector3.Dot(axis, toTarget.normalize()) > minDot;
}

/** Aim mount toward the point on the crosshair axis at `convergenceDistance`. */
export function computeConvergenceDirection(
  mountPos: Vector3,
  axisOrigin: Vector3,
  axisDirection: Vector3,
  convergenceDistance: number,
): Vector3 {
  const axis = axisDirection.normalize();
  const convergencePoint = axisOrigin.add(axis.scale(convergenceDistance));
  const toPoint = convergencePoint.subtract(mountPos);
  if (isNearZero(toPoint)) {
    return axis.clone();
  }
  return toPoint.normalize();
}

/** Predict intercept direction using relative velocity quadratic solve. */
export function computeLeadDirection(
  origin: Vector3,
  targetPos: Vector3,
  targetVel: Vector3,
  projectileSpeed: number,
  shooterVel: Vector3 = Vector3.Zero(),
): Vector3 {
  const relPos = targetPos.subtract(origin);
  const distSq = relPos.lengthSquared();
  if (isNearZero(relPos)) {
    return safeNormalize(relPos, Vector3.Forward());
  }

  if (projectileSpeed < 1e-4) {
    return relPos.normalize();
  }

  const relVel = targetVel.subtract(shooterVel);
  const speedSq = projectileSpeed * projectileSpeed;
  const a = Vector3.Dot(relVel, relVel) - speedSq;
  const b = 2 * Vector3.Dot(relPos, relVel);
  const c = distSq;

  let interceptTime: number | null = null;

  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) {
      const tLin = -c / b;
      if (tLin > 1e-4) {
        interceptTime = tLin;
      }
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);
      const positive = [t1, t2].filter((t) => t > 1e-4 && Number.isFinite(t));
      if (positive.length > 0) {
        interceptTime = Math.min(...positive);
      }
    }
  }

  if (interceptTime == null) {
    return relPos.normalize();
  }

  const intercept = relPos.add(relVel.scale(interceptTime));
  if (isNearZero(intercept)) {
    return relPos.normalize();
  }
  return intercept.normalize();
}

/** Clamp desired aim to a cone around a fixed rest axis (radians). */
export function clampToDeflectionCone(
  restForward: Vector3,
  desiredDir: Vector3,
  maxDeflectionRad: number,
): Vector3 {
  const forward = restForward.normalize();
  const desired = desiredDir.normalize();
  const dot = clamp(Vector3.Dot(forward, desired), -1, 1);

  if (dot <= 0) {
    return forward.clone();
  }

  const angle = Math.acos(dot);

  if (angle <= maxDeflectionRad) {
    return desired;
  }

  const axis = Vector3.Cross(forward, desired);
  if (isNearZero(axis, 1e-8)) {
    return forward;
  }

  const limited = Quaternion.RotationAxis(axis.normalize(), maxDeflectionRad);
  const rotMat = Matrix.Identity();
  limited.toRotationMatrix(rotMat);
  return Vector3.TransformNormal(forward, rotMat).normalize();
}
