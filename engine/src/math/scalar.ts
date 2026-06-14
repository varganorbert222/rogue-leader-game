import { Scalar } from '@babylonjs/core';

export function clamp(v: number, min: number, max: number): number {
  return Scalar.Clamp(v, min, max);
}

export function clampSymmetric(v: number, limit: number): number {
  return clamp(v, -limit, limit);
}

export const PITCH_MULTIPLIER_MIN = 0.5;
export const PITCH_MULTIPLIER_MAX = 2;

export function clampPitchMultiplier(pitch: number): number {
  return clamp(pitch, PITCH_MULTIPLIER_MIN, PITCH_MULTIPLIER_MAX);
}
