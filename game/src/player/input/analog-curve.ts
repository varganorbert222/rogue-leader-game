import { clamp } from '@rogue-leader/engine';
import type { AxisCurveSettings } from '../settings/control-bindings';

/** Radial deadzone with linear rescale to full stick range. */
export function applyRadialDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * ((Math.abs(value) - deadzone) / (1 - deadzone));
}

/** Map a -1..1 trigger axis to 0..1 (PlayStation-style axes). */
export function normalizeTriggerAxis(value: number): number {
  return clamp((value + 1) * 0.5, 0, 1);
}

/** Stick/trigger axis: deadzone, exponent curve, sensitivity, optional invert. */
export function applyAxisCurve(value: number, settings: AxisCurveSettings): number {
  let v = settings.invert ? -value : value;
  const dz = clamp(settings.deadzone, 0, 0.45);
  if (Math.abs(v) <= dz) {
    return 0;
  }
  const sign = Math.sign(v);
  const normalized = (Math.abs(v) - dz) / (1 - dz);
  const curved = Math.pow(normalized, Math.max(0.5, settings.exponent));
  return sign * curved * settings.sensitivity;
}
