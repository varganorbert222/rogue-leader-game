import { Matrix, Quaternion, Scalar, Vector3 } from '@babylonjs/core';

/** Slerp between unit directions with a max angular step (rad). */
export function rotateTowardDirection(
  current: Vector3,
  desired: Vector3,
  maxAngleRad: number
): Vector3 {
  const from = current.normalize();
  const to = desired.normalize();
  const dot = Scalar.Clamp(Vector3.Dot(from, to), -1, 1);
  const angle = Math.acos(dot);
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
  minDot = 0
): boolean {
  const axis = axisDirection.normalize();
  const toTarget = targetPos.subtract(axisOrigin);
  if (toTarget.lengthSquared() < 1e-6) {
    return false;
  }
  return Vector3.Dot(axis, toTarget.normalize()) > minDot;
}

/** Aim mount toward the point on the crosshair axis at `convergenceDistance`. */
export function computeConvergenceDirection(
  mountPos: Vector3,
  axisOrigin: Vector3,
  axisDirection: Vector3,
  convergenceDistance: number
): Vector3 {
  const axis = axisDirection.normalize();
  const convergencePoint = axisOrigin.add(axis.scale(convergenceDistance));
  const toPoint = convergencePoint.subtract(mountPos);
  if (toPoint.lengthSquared() < 1e-6) {
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
  shooterVel: Vector3 = Vector3.Zero()
): Vector3 {
  const relPos = targetPos.subtract(origin);
  if (relPos.lengthSquared() < 1e-6) {
    return new Vector3(0, 0, 1);
  }

  const relVel = targetVel.subtract(shooterVel);
  const speedSq = projectileSpeed * projectileSpeed;
  const a = Vector3.Dot(relVel, relVel) - speedSq;
  const b = 2 * Vector3.Dot(relPos, relVel);
  const c = Vector3.Dot(relPos, relPos);

  let t: number;
  if (Math.abs(a) < 1e-6) {
    t = -c / Math.max(b, 1e-4);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      return relPos.normalize();
    }
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);
    if (t1 > 0) t = t1;
    else if (t2 > 0) t = t2;
    else t = Math.max(t1, t2);
  }

  if (!Number.isFinite(t) || t <= 0) {
    return relPos.normalize();
  }

  const aimPoint = targetPos.add(targetVel.scale(t));
  return aimPoint.subtract(origin).normalize();
}

/** Clamp desired aim to a cone around mount rest forward (radians). */
export function clampToDeflectionCone(
  mountForward: Vector3,
  desiredDir: Vector3,
  maxDeflectionRad: number
): Vector3 {
  const forward = mountForward.normalize();
  const desired = desiredDir.normalize();
  const dot = Scalar.Clamp(Vector3.Dot(forward, desired), -1, 1);

  if (dot < 0) {
    return forward.clone();
  }

  const angle = Math.acos(dot);

  if (angle <= maxDeflectionRad) {
    return desired;
  }

  const axis = Vector3.Cross(forward, desired);
  if (axis.lengthSquared() < 1e-8) {
    return forward;
  }

  const limited = Quaternion.RotationAxis(axis.normalize(), maxDeflectionRad);
  const rotMat = Matrix.Identity();
  limited.toRotationMatrix(rotMat);
  return Vector3.TransformNormal(forward, rotMat).normalize();
}
