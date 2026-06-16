import { degToRad } from '../../math';

/** Babylon default particle simulation step scale. */
export const BABYLON_PARTICLE_UPDATE_BASE = 0.01;

/** Reference frame rate used to map m/s to Babylon emit power. */
export const PARTICLE_SPEED_REFERENCE_FPS = 60;

export function mpsToEmitPower(speedMps: number, playbackSpeed: number): number {
  const scale =
    BABYLON_PARTICLE_UPDATE_BASE * Math.max(playbackSpeed, 1e-6) * PARTICLE_SPEED_REFERENCE_FPS;
  return speedMps / scale;
}

export function emitPowerToMps(emitPower: number, playbackSpeed: number): number {
  const scale =
    BABYLON_PARTICLE_UPDATE_BASE * Math.max(playbackSpeed, 1e-6) * PARTICLE_SPEED_REFERENCE_FPS;
  return emitPower * scale;
}

export function degPerSecToRadians(degPerSec: number): number {
  return degToRad(degPerSec);
}

export function babylonUpdateSpeed(playbackSpeed: number): number {
  return BABYLON_PARTICLE_UPDATE_BASE * Math.max(playbackSpeed, 0);
}
