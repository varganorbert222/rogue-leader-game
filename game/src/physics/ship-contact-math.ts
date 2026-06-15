import { Vector3 } from '@babylonjs/core';

/** Tunable contact material for arcade hull impacts. */
export interface ContactMaterialParams {
  /** Normal-direction bounce (0 = inelastic, 1 = elastic). */
  restitution: number;
  /** Tangential impulse cap as a fraction of normal impulse. */
  friction: number;
  /** How much tangential speed is retained after impact (0–1). */
  slideRetention: number;
}

export const DEFAULT_SHIP_CONTACT_MATERIAL: ContactMaterialParams = {
  restitution: 0.34,
  friction: 0.48,
  slideRetention: 0.68,
};

export const DEFAULT_ASTEROID_CONTACT_MATERIAL: ContactMaterialParams = {
  restitution: 0.2,
  friction: 0.58,
  slideRetention: 0.5,
};

export interface SphereOverlapContact {
  /** Unit normal pointing from B toward A. */
  normalFromBToA: Vector3;
  overlap: number;
  contactPoint: Vector3;
  relativeVelocity: Vector3;
  closingSpeed: number;
}

export interface ContactImpactAnalysis {
  closingSpeed: number;
  relativeSpeed: number;
  /** 0 = grazing slide, 1 = head-on. */
  headOnFactor: number;
}

export interface ContactSeparation {
  pushA: Vector3;
  pushB: Vector3;
}

export interface ContactVelocityResponse {
  deltaA: Vector3;
  deltaB: Vector3;
  impactSeverity: number;
}

export interface SphereOverlapInput {
  positionA: Vector3;
  radiusA: number;
  velocityA: Vector3;
  positionB: Vector3;
  radiusB: number;
  velocityB: Vector3;
}

/** Detect overlapping spheres and derive contact kinematics. */
export function resolveSphereOverlap(
  input: SphereOverlapInput,
): SphereOverlapContact | null {
  const delta = input.positionA.clone().subtract(input.positionB);
  const dist = delta.length();
  const minDist = input.radiusA + input.radiusB;
  if (dist >= minDist || dist < 1e-4) return null;

  const normalFromBToA = delta.scale(1 / dist);
  const overlap = minDist - dist;
  const relativeVelocity = input.velocityA.clone().subtract(input.velocityB);
  const closingSpeed = Math.max(
    0,
    -Vector3.Dot(relativeVelocity, normalFromBToA),
  );
  const contactPoint = input.positionB
    .clone()
    .add(normalFromBToA.scale(input.radiusB));

  return {
    normalFromBToA,
    overlap,
    contactPoint,
    relativeVelocity,
    closingSpeed,
  };
}

export function analyzeContactImpact(
  relativeVelocity: Vector3,
  normalFromBToA: Vector3,
): ContactImpactAnalysis {
  const relativeSpeed = relativeVelocity.length();
  const closingSpeed = Math.max(
    0,
    -Vector3.Dot(relativeVelocity, normalFromBToA),
  );
  const headOnFactor =
    relativeSpeed > 1e-4 ? closingSpeed / relativeSpeed : 0;
  return { closingSpeed, relativeSpeed, headOnFactor };
}

/** Positional separation along the contact normal. */
export function computeContactSeparation(
  normalFromBToA: Vector3,
  overlap: number,
  massRatioA = 0.5,
): ContactSeparation {
  const pushA = normalFromBToA.scale(overlap * massRatioA);
  const pushB = normalFromBToA.scale(-overlap * (1 - massRatioA));
  return { pushA, pushB };
}

/**
 * Impulse-based velocity change for a contact.
 * Uses normal restitution plus Coulomb-style tangential friction.
 */
export function resolveContactVelocityChange(params: {
  velocityA: Vector3;
  velocityB: Vector3;
  normalFromBToA: Vector3;
  massA?: number;
  massB?: number;
  material: ContactMaterialParams;
}): ContactVelocityResponse {
  const massA = params.massA ?? 1;
  const massB = params.massB ?? 1;
  const invMassSum = 1 / massA + 1 / massB;
  const n = params.normalFromBToA;
  const relVel = params.velocityA.clone().subtract(params.velocityB);
  const analysis = analyzeContactImpact(relVel, n);

  if (analysis.closingSpeed <= 0) {
    return {
      deltaA: Vector3.Zero(),
      deltaB: Vector3.Zero(),
      impactSeverity: 0,
    };
  }

  const normalImpulse =
    (-(1 + params.material.restitution) * analysis.closingSpeed) / invMassSum;
  const impulseN = n.scale(normalImpulse);

  const vn = Vector3.Dot(relVel, n);
  const tangent = relVel.subtract(n.scale(vn));
  const tangentLen = tangent.length();
  let frictionImpulse = Vector3.Zero();
  if (tangentLen > 1e-4) {
    const tangentDir = tangent.scale(1 / tangentLen);
    const maxFriction = params.material.friction * Math.abs(normalImpulse);
    const frictionMag = Math.min(maxFriction, tangentLen / invMassSum);
    frictionImpulse = tangentDir.scale(-frictionMag);
  }

  const totalImpulse = impulseN.add(frictionImpulse);
  const deltaA = totalImpulse.scale(1 / massA);
  const deltaB = totalImpulse.scale(-1 / massB);

  const headOnSq = analysis.headOnFactor * analysis.headOnFactor;
  const impactSeverity =
    (analysis.closingSpeed / 45) * (0.18 + 0.82 * headOnSq);

  return { deltaA, deltaB, impactSeverity };
}

/** Hull damage from impact speed and angle (head-on hurts more than a glancing slide). */
export function computeContactHullDamage(params: {
  closingSpeed: number;
  headOnFactor: number;
  speedThreshold?: number;
  scale?: number;
}): number {
  const threshold = params.speedThreshold ?? 14;
  const scale = params.scale ?? 1.15;
  if (params.closingSpeed < threshold) return 0;

  const speedTerm = params.closingSpeed - threshold;
  const angleMult = 0.1 + 0.9 * params.headOnFactor * params.headOnFactor;
  return Math.round(speedTerm * scale * angleMult);
}

/** Decompose a world velocity into normal/tangent parts relative to a contact normal. */
export function decomposeVelocityAlongNormal(
  velocity: Vector3,
  normal: Vector3,
): { normal: Vector3; tangent: Vector3 } {
  const vn = Vector3.Dot(velocity, normal);
  const normalComponent = normal.scale(vn);
  return {
    normal: normalComponent,
    tangent: velocity.subtract(normalComponent),
  };
}

/** Blend a forward-only heading toward a post-impact slide direction. */
export function blendHeadingTowardVelocity(
  currentForward: Vector3,
  postImpactVelocity: Vector3,
  blend: number,
): Vector3 {
  const slide = postImpactVelocity.clone();
  if (slide.lengthSquared() < 1e-4) return currentForward.clone();

  slide.normalize();
  const t = Math.max(0, Math.min(1, blend));
  return Vector3.Lerp(currentForward, slide, t).normalize();
}
