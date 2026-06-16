import {
  cloneVec3,
  type Vec3Editable,
  vec3,
} from '../shared/editable-primitives';
import {
  cloneCurveKeyframes,
  normalizeCurveKeyframes,
  type CurveKeyframeEditable,
  type CurvePreset,
  type LifetimeCurveMode,
} from '../shared/lifetime-curves';

export type SizeOverLifetimeMode = LifetimeCurveMode;
export type RotationOverLifetimeMode = LifetimeCurveMode;

export interface SizeOverLifetimeEditable {
  mode: SizeOverLifetimeMode;
  rangeStart: number;
  rangeEnd: number;
  keyframes: CurveKeyframeEditable[];
}

export interface Vec3CurveKeyframeEditable {
  time: number;
  value: Vec3Editable;
}

export interface RotationOverLifetimeEditable {
  mode: RotationOverLifetimeMode;
  rangeStart: Vec3Editable;
  rangeEnd: Vec3Editable;
  keyframes: Vec3CurveKeyframeEditable[];
}

export interface Vec3CurvePreset {
  id: string;
  label: string;
  keyframes: Vec3CurveKeyframeEditable[];
}

export const SIZE_OVER_LIFETIME_PRESETS: readonly CurvePreset[] = [
  {
    id: 'linear_fade',
    label: 'Linear fade',
    keyframes: [
      { time: 0, value: 1 },
      { time: 1, value: 0 },
    ],
  },
  {
    id: 'linear_grow',
    label: 'Linear grow',
    keyframes: [
      { time: 0, value: 0 },
      { time: 1, value: 1 },
    ],
  },
  {
    id: 'quick_shrink',
    label: 'Quick shrink',
    keyframes: [
      { time: 0, value: 1 },
      { time: 0.2, value: 0.15 },
      { time: 1, value: 0 },
    ],
  },
  {
    id: 'pulse',
    label: 'Pulse',
    keyframes: [
      { time: 0, value: 0.2 },
      { time: 0.15, value: 1 },
      { time: 0.7, value: 1 },
      { time: 1, value: 0 },
    ],
  },
  {
    id: 'ease_out',
    label: 'Ease out',
    keyframes: [
      { time: 0, value: 0 },
      { time: 0.2, value: 0.85 },
      { time: 1, value: 1 },
    ],
  },
  {
    id: 'flat',
    label: 'Flat ×1',
    keyframes: [
      { time: 0, value: 1 },
      { time: 1, value: 1 },
    ],
  },
];

export const ROTATION_OVER_LIFETIME_PRESETS: readonly Vec3CurvePreset[] =
  SIZE_OVER_LIFETIME_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    keyframes: preset.keyframes.map((kf) => ({
      time: kf.time,
      value: vec3(kf.value, kf.value, kf.value),
    })),
  }));

export function defaultSizeOverLifetime(): SizeOverLifetimeEditable {
  return {
    mode: 'range',
    rangeStart: 1,
    rangeEnd: 0,
    keyframes: [
      { time: 0, value: 1 },
      { time: 1, value: 0 },
    ],
  };
}

export function defaultRotationOverLifetime(): RotationOverLifetimeEditable {
  return {
    mode: 'range',
    rangeStart: vec3(1, 1, 1),
    rangeEnd: vec3(0, 0, 0),
    keyframes: [
      { time: 0, value: vec3(1, 1, 1) },
      { time: 1, value: vec3(0, 0, 0) },
    ],
  };
}

export function normalizeSizeOverLifetime(
  patch: Partial<SizeOverLifetimeEditable> | undefined,
): SizeOverLifetimeEditable {
  const defaults = defaultSizeOverLifetime();
  const mode: SizeOverLifetimeMode =
    patch?.mode === 'curve' || patch?.mode === 'range' ? patch.mode : defaults.mode;

  return {
    mode,
    rangeStart: Math.max(0, patch?.rangeStart ?? defaults.rangeStart),
    rangeEnd: Math.max(0, patch?.rangeEnd ?? defaults.rangeEnd),
    keyframes: normalizeCurveKeyframes(patch?.keyframes ?? defaults.keyframes),
  };
}

export function normalizeVec3CurveKeyframes(
  keyframes: readonly Vec3CurveKeyframeEditable[],
): Vec3CurveKeyframeEditable[] {
  if (!keyframes.length) {
    return [
      { time: 0, value: vec3(1, 1, 1) },
      { time: 1, value: vec3(1, 1, 1) },
    ];
  }

  const sorted = [...keyframes]
    .map((kf) => ({
      time: clamp01(kf.time),
      value: cloneVec3(kf.value),
    }))
    .sort((a, b) => a.time - b.time);

  const merged: Vec3CurveKeyframeEditable[] = [];
  for (const kf of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.time - kf.time) < 0.0001) {
      prev.value = cloneVec3(kf.value);
      continue;
    }
    merged.push({ time: kf.time, value: cloneVec3(kf.value) });
  }

  if (merged[0].time > 0) {
    merged.unshift({ time: 0, value: cloneVec3(merged[0].value) });
  } else {
    merged[0].time = 0;
  }

  const last = merged[merged.length - 1];
  if (last.time < 1) {
    merged.push({ time: 1, value: cloneVec3(last.value) });
  } else {
    last.time = 1;
  }

  return merged;
}

export function normalizeRotationOverLifetime(
  patch: Partial<RotationOverLifetimeEditable> | undefined,
): RotationOverLifetimeEditable {
  const defaults = defaultRotationOverLifetime();
  const mode: RotationOverLifetimeMode =
    patch?.mode === 'curve' || patch?.mode === 'range' ? patch.mode : defaults.mode;

  return {
    mode,
    rangeStart: mergeVec3Multiplier(defaults.rangeStart, patch?.rangeStart),
    rangeEnd: mergeVec3Multiplier(defaults.rangeEnd, patch?.rangeEnd),
    keyframes: normalizeVec3CurveKeyframes(patch?.keyframes ?? defaults.keyframes),
  };
}

export function getSizeOverLifetimePreset(id: string): CurvePreset | undefined {
  return SIZE_OVER_LIFETIME_PRESETS.find((preset) => preset.id === id);
}

export function getRotationOverLifetimePreset(id: string): Vec3CurvePreset | undefined {
  return ROTATION_OVER_LIFETIME_PRESETS.find((preset) => preset.id === id);
}

export function cloneVec3CurveKeyframes(
  keyframes: readonly Vec3CurveKeyframeEditable[],
): Vec3CurveKeyframeEditable[] {
  return keyframes.map((kf) => ({ time: kf.time, value: cloneVec3(kf.value) }));
}

export {
  cloneCurveKeyframes,
  normalizeCurveKeyframes,
  type CurveKeyframeEditable,
  type CurvePreset,
};

function mergeVec3Multiplier(base: Vec3Editable, patch?: Partial<Vec3Editable>): Vec3Editable {
  if (!patch) return cloneVec3(base);
  return {
    x: patch.x ?? base.x,
    y: patch.y ?? base.y,
    z: patch.z ?? base.z,
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
