import type { ParticleSystem } from '@babylonjs/core';
import { degToRad } from '../../../math';
import type { Vec3Editable } from '../../shared/editable-primitives';
import { normalizeVec3CurveKeyframes } from '../curves';
import type { ParticleSystemEditable } from '../types';
import { degPerSecToRadians } from '../units';

function clearAngularSpeedGradients(ps: ParticleSystem): void {
  const gradients = ps.getAngularSpeedGradients();
  if (!gradients?.length) return;
  for (const gradient of [...gradients]) {
    ps.removeAngularSpeedGradient(gradient.gradient);
  }
}

function applySpawnRotationSpeed(ps: ParticleSystem, config: ParticleSystemEditable): void {
  ps.minAngularSpeed = degPerSecToRadians(config.minRotationSpeedDeg.z);
  ps.maxAngularSpeed = degPerSecToRadians(config.maxRotationSpeedDeg.z);
}

function addAngularSpeedMultiplierGradient(
  ps: ParticleSystem,
  time: number,
  multiplier: Vec3Editable,
  config: ParticleSystemEditable,
): void {
  ps.addAngularSpeedGradient(
    time,
    degPerSecToRadians(config.maxRotationSpeedDeg.z * multiplier.z),
    degPerSecToRadians(config.minRotationSpeedDeg.z * multiplier.z),
  );
}

export function applyRotationOverLifetime(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
): void {
  clearAngularSpeedGradients(ps);

  ps.minInitialRotation = degToRad(config.minStartRotationDeg.z);
  ps.maxInitialRotation = degToRad(config.maxStartRotationDeg.z);
  applySpawnRotationSpeed(ps, config);

  const rotationOverLifetime = config.rotationOverLifetime;

  if (rotationOverLifetime.mode === 'range') {
    addAngularSpeedMultiplierGradient(ps, 0, rotationOverLifetime.rangeStart, config);
    addAngularSpeedMultiplierGradient(ps, 1, rotationOverLifetime.rangeEnd, config);
    return;
  }

  const keyframes = normalizeVec3CurveKeyframes(rotationOverLifetime.keyframes);
  for (const keyframe of keyframes) {
    addAngularSpeedMultiplierGradient(ps, keyframe.time, keyframe.value, config);
  }
}
