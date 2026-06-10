import { Vector3 } from '@babylonjs/core';
import type { FlockMate } from './flock-types';

export const BOID_NEIGHBOR_RADIUS = 140;
export const MIN_SEPARATION_PADDING = 3;

export function computeFlockCenter(positions: Vector3[]): Vector3 {
  if (positions.length === 0) return Vector3.Zero();

  const center = Vector3.Zero();
  for (const position of positions) {
    center.addInPlace(position);
  }
  return center.scale(1 / positions.length);
}

export function computeSeparation(
  position: Vector3,
  selfRadius: number,
  neighbors: FlockMate[],
  maxRadius = BOID_NEIGHBOR_RADIUS
): Vector3 {
  const steer = Vector3.Zero();

  for (const neighbor of neighbors) {
    const offset = position.clone().subtract(neighbor.position);
    const dist = offset.length();
    if (dist < 1e-4 || dist > maxRadius) continue;

    const minDist = selfRadius + neighbor.radius + MIN_SEPARATION_PADDING;
    if (dist < minDist) {
      const strength = (minDist - dist) / minDist;
      steer.addInPlace(offset.normalize().scale(strength));
    }
  }

  return steer;
}

export function computeAlignment(
  position: Vector3,
  neighbors: FlockMate[],
  maxRadius = BOID_NEIGHBOR_RADIUS
): Vector3 {
  const avg = Vector3.Zero();
  let count = 0;

  for (const neighbor of neighbors) {
    const dist = Vector3.Distance(position, neighbor.position);
    if (dist > maxRadius) continue;
    avg.addInPlace(neighbor.velocity);
    count++;
  }

  if (count === 0) return Vector3.Zero();
  avg.scaleInPlace(1 / count);
  if (avg.lengthSquared() < 1e-4) return Vector3.Zero();
  return avg.normalize();
}

export function computeCohesion(
  position: Vector3,
  flockCenter: Vector3,
  maxRadius = BOID_NEIGHBOR_RADIUS
): Vector3 {
  const toCenter = flockCenter.clone().subtract(position);
  const dist = toCenter.length();
  if (dist < 1e-4 || dist > maxRadius) return Vector3.Zero();
  return toCenter.normalize();
}

/** Hard positional nudge so ships never occupy the same space. */
export function resolveFlockOverlap(
  position: Vector3,
  selfRadius: number,
  neighbors: FlockMate[]
): void {
  for (const neighbor of neighbors) {
    const offset = position.clone().subtract(neighbor.position);
    const dist = offset.length();
    const minDist = selfRadius + neighbor.radius + MIN_SEPARATION_PADDING;
    if (dist >= minDist || dist < 1e-4) continue;

    position.addInPlace(offset.normalize().scale((minDist - dist) * 0.55));
  }
}
