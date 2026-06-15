import { Vector3 } from '@babylonjs/core';
import {
  analyzeContactImpact,
  computeContactHullDamage,
  computeContactSeparation,
  resolveContactVelocityChange,
  resolveSphereOverlap,
  type ContactMaterialParams,
  type SphereOverlapInput,
} from '../physics/ship-contact-math';

export interface SphereCollisionPair {
  positionA: Vector3;
  radiusA: number;
  velocityA: Vector3;
  positionB: Vector3;
  radiusB: number;
  velocityB: Vector3;
  massA?: number;
  massB?: number;
  material?: ContactMaterialParams;
}

export interface SphereCollisionResult {
  pushA: Vector3;
  pushB: Vector3;
  relativeApproach: number;
  headOnFactor: number;
  contactPoint: Vector3;
  normalFromBToA: Vector3;
  velocityDeltaA: Vector3;
  velocityDeltaB: Vector3;
  impactSeverity: number;
}

/** Separates overlapping spheres and resolves bounce/slide velocity changes. */
export function resolveSphereCollision(
  pair: SphereCollisionPair,
): SphereCollisionResult | null {
  const overlap = resolveSphereOverlap(pair as SphereOverlapInput);
  if (!overlap || overlap.closingSpeed < 1) return null;

  const { pushA, pushB } = computeContactSeparation(
    overlap.normalFromBToA,
    overlap.overlap,
    pair.massA && pair.massB
      ? pair.massB / (pair.massA + pair.massB)
      : 0.5,
  );

  const material = pair.material;
  const velocityChange = material
    ? resolveContactVelocityChange({
        velocityA: pair.velocityA,
        velocityB: pair.velocityB,
        normalFromBToA: overlap.normalFromBToA,
        massA: pair.massA,
        massB: pair.massB,
        material,
      })
    : {
        deltaA: Vector3.Zero(),
        deltaB: Vector3.Zero(),
        impactSeverity: 0,
      };

  const analysis = analyzeContactImpact(
    overlap.relativeVelocity,
    overlap.normalFromBToA,
  );

  return {
    pushA,
    pushB,
    relativeApproach: overlap.closingSpeed,
    headOnFactor: analysis.headOnFactor,
    contactPoint: overlap.contactPoint,
    normalFromBToA: overlap.normalFromBToA,
    velocityDeltaA: velocityChange.deltaA,
    velocityDeltaB: velocityChange.deltaB,
    impactSeverity: velocityChange.impactSeverity,
  };
}

export function computeCollisionDamage(
  closingSpeed: number,
  headOnFactor: number,
): number {
  return computeContactHullDamage({ closingSpeed, headOnFactor });
}
