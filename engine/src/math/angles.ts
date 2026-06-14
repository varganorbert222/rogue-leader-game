export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/** Wrap radians to [-π, π]. */
export function wrapAngleRad(delta: number): number {
  let wrapped = delta;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

/** Shortest-path interpolation between two angles (radians). */
export function lerpAngleRad(current: number, target: number, t: number): number {
  return current + wrapAngleRad(target - current) * t;
}
