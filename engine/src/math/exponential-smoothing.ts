/** Frame-rate–independent first-order smoothing factor (0–1). */
export function expSmoothingFactor(ratePerSec: number, dt: number): number {
  return 1 - Math.exp(-ratePerSec * dt);
}

/** Exponential approach of a scalar toward a target. */
export function approachScalar(
  current: number,
  target: number,
  ratePerSec: number,
  dt: number,
): number {
  return current + (target - current) * expSmoothingFactor(ratePerSec, dt);
}

/** Per-frame decay multiplier (e.g. damping). */
export function expDecayFactor(dampingPerSec: number, dt: number): number {
  return Math.exp(-dampingPerSec * dt);
}

/** Power-base smoothing used when response should differ by direction. */
export function powSmoothingFactor(base: number, dt: number): number {
  return 1 - Math.pow(base, dt);
}
