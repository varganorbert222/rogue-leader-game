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

/** Critically damped spring toward target (Unity SmoothDamp-style). Handles sign reversals naturally. */
export function smoothDampedScalar(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): { value: number; velocity: number } {
  if (dt <= 0 || smoothTime <= 0) {
    return { value: current, velocity };
  }

  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVel = (velocity - omega * temp) * exp;
  const newValue = target + (change + temp) * exp;

  return { value: newValue, velocity: newVel };
}
