import { Vector3 } from '@babylonjs/core';

export function randomInRange(
  min: number,
  max: number,
  rand: () => number = Math.random,
): number {
  return min + rand() * (max - min);
}

export function randomSign(rand: () => number = Math.random): number {
  return rand() > 0.5 ? 1 : -1;
}

/** Uniform direction on the unit sphere (Y-up polar axis). */
export function randomUnitVector(rand: () => number = Math.random): Vector3 {
  const u = rand();
  const v = rand();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

/** Uniform direction on the unit sphere (Z-up polar axis — mission/asteroid space). */
export function randomUnitVectorZUp(rand: () => number = Math.random): Vector3 {
  const u = rand();
  const v = rand();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  );
}

export function randomPointInSphericalShell(
  center: Vector3,
  innerRadius: number,
  outerRadius: number,
  rand: () => number = Math.random,
): Vector3 {
  const direction = randomUnitVectorZUp(rand);
  const radius = randomInRange(innerRadius, outerRadius, rand);
  return center.add(direction.scale(radius));
}

export function randomVector3InRange(
  min: number,
  max: number,
  rand: () => number = Math.random,
): Vector3 {
  return new Vector3(
    randomInRange(min, max, rand),
    randomInRange(min, max, rand),
    randomInRange(min, max, rand),
  );
}

/** Normalized random axis for tumble / debris spin. */
export function randomTumbleAxis(rand: () => number = Math.random): Vector3 {
  return new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
}
