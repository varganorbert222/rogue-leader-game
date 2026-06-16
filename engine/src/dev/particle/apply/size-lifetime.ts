import type { ParticleSystem } from '@babylonjs/core';
import { normalizeCurveKeyframes } from '../curves';
import type { ParticleSystemEditable } from '../types';

function clearSizeGradients(ps: ParticleSystem): void {
  const gradients = ps.getSizeGradients();
  if (!gradients?.length) return;
  for (const gradient of [...gradients]) {
    ps.removeSizeGradient(gradient.gradient);
  }
}

function applySpawnSize(ps: ParticleSystem, config: ParticleSystemEditable): void {
  ps.minSize = config.minSize;
  ps.maxSize = config.maxSize;
}

function addSizeMultiplierGradient(
  ps: ParticleSystem,
  time: number,
  multiplier: number,
  config: ParticleSystemEditable,
): void {
  ps.addSizeGradient(
    time,
    multiplier * config.maxSize,
    multiplier * config.minSize,
  );
}

export function applySizeOverLifetime(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
): void {
  clearSizeGradients(ps);
  applySpawnSize(ps, config);

  const sizeOverLifetime = config.sizeOverLifetime;

  if (sizeOverLifetime.mode === 'range') {
    addSizeMultiplierGradient(ps, 0, sizeOverLifetime.rangeStart, config);
    addSizeMultiplierGradient(ps, 1, sizeOverLifetime.rangeEnd, config);
    return;
  }

  const keyframes = normalizeCurveKeyframes(sizeOverLifetime.keyframes);
  for (const keyframe of keyframes) {
    addSizeMultiplierGradient(ps, keyframe.time, keyframe.value, config);
  }
}
