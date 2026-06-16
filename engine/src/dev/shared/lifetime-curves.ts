import { clamp01 } from './editable-primitives';

export type LifetimeCurveMode = 'range' | 'curve';

export interface CurveKeyframeEditable {
  time: number;
  value: number;
}

export interface CurvePreset {
  id: string;
  label: string;
  keyframes: CurveKeyframeEditable[];
}

export function cloneCurveKeyframes(
  keyframes: readonly CurveKeyframeEditable[],
): CurveKeyframeEditable[] {
  return keyframes.map((kf) => ({ ...kf }));
}

export function normalizeCurveKeyframes(
  keyframes: readonly CurveKeyframeEditable[],
): CurveKeyframeEditable[] {
  if (!keyframes.length) {
    return [
      { time: 0, value: 1 },
      { time: 1, value: 1 },
    ];
  }

  const sorted = [...keyframes]
    .map((kf) => ({
      time: clamp01(kf.time),
      value: Math.max(0, kf.value),
    }))
    .sort((a, b) => a.time - b.time);

  const merged: CurveKeyframeEditable[] = [];
  for (const kf of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.time - kf.time) < 0.0001) {
      prev.value = kf.value;
      continue;
    }
    merged.push({ ...kf });
  }

  if (merged[0].time > 0) {
    merged.unshift({ time: 0, value: merged[0].value });
  } else {
    merged[0].time = 0;
  }

  const last = merged[merged.length - 1];
  if (last.time < 1) {
    merged.push({ time: 1, value: last.value });
  } else {
    last.time = 1;
  }

  return merged;
}
