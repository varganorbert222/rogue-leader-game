import type { ParticleSystem } from '@babylonjs/core';
import type { ParticleEffectEditable, ParticleSystemEditable } from './types';
import { resolveParticleEffect } from './refs';

const LOOP_POLL_MS = 50;

/** Maps Unity Main.duration to Babylon emission stop time (0 = emit until stopped). */
export function applyEmissionDuration(ps: ParticleSystem, config: ParticleSystemEditable): void {
  if (config.emissionMode === 'rate' && config.duration > 0) {
    ps.targetStopDuration = config.duration;
  } else {
    ps.targetStopDuration = 0;
  }
}

export function burstReleaseMs(config: ParticleSystemEditable): number {
  const playbackSpeed = Math.max(config.playbackSpeed, 0.05);
  return Math.max(300, (config.maxLifeTime * 1000 + 200) / playbackSpeed);
}

/** Minimum wall-clock time for one loop cycle (delay + duration), scaled by playback speed. */
export function loopCycleDurationMs(config: ParticleSystemEditable): number {
  const playbackSpeed = Math.max(config.playbackSpeed, 0.05);
  const seconds = config.duration > 0
    ? config.startDelay + config.duration
    : config.startDelay;
  return (seconds * 1000) / playbackSpeed;
}

export function startParticlePlayback(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  timers: number[],
): void {
  ps.stop();
  ps.reset();
  startEmission(ps, config);

  if (config.looping) {
    scheduleLoopRestart(ps, config, timers);
  } else if (config.emissionMode === 'burst') {
    timers.push(window.setTimeout(() => ps.stop(), burstReleaseMs(config)));
  }
}

function startEmission(ps: ParticleSystem, config: ParticleSystemEditable): void {
  if (config.emissionMode === 'burst') {
    ps.manualEmitCount = config.burstCount;
    ps.targetStopDuration = 0;
    ps.start(config.startDelay);
    return;
  }

  ps.manualEmitCount = -1;
  applyEmissionDuration(ps, config);
  ps.start(config.startDelay);
}

function scheduleLoopRestart(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  timers: number[],
): void {
  const cycleStartedAtMs = performance.now();

  const poll = () => {
    if (!canRestartLoopCycle(ps, config, cycleStartedAtMs)) {
      timers.push(window.setTimeout(poll, LOOP_POLL_MS));
      return;
    }

    ps.stop();
    ps.reset();
    startEmission(ps, config);
    scheduleLoopRestart(ps, config, timers);
  };

  timers.push(window.setTimeout(poll, LOOP_POLL_MS));
}

function canRestartLoopCycle(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  cycleStartedAtMs: number,
): boolean {
  const minCycleMs = loopCycleDurationMs(config);
  if (performance.now() - cycleStartedAtMs < minCycleMs) {
    return false;
  }

  if (config.emissionMode === 'burst' && ps.manualEmitCount > 0) {
    return false;
  }

  return ps.getActiveCount() === 0;
}

/** Wall-clock preview length for editor play button (non-looping effects). */
export function estimateSystemPreviewDurationMs(config: ParticleSystemEditable): number {
  const playbackSpeed = Math.max(config.playbackSpeed, 0.05);
  const lifeMs = (config.maxLifeTime * 1000 + 400) / playbackSpeed;

  if (config.emissionMode === 'burst') {
    return Math.max(lifeMs, burstReleaseMs(config));
  }

  if (config.emissionMode === 'rate' && config.duration > 0) {
    return loopCycleDurationMs(config) + lifeMs;
  }

  return lifeMs;
}

export function estimateEffectPreviewDurationMs(
  effect: ParticleEffectEditable,
  catalog: readonly import('./types').ParticlePresetEntry[] = [],
): number {
  const resolved = catalog.length ? resolveParticleEffect(effect, catalog) : [];
  const configs = resolved.length
    ? resolved
    : effect.systems
        .map((slot) => slot.config)
        .filter((config): config is ParticleSystemEditable => !!config);

  if (!configs.length) return 2000;
  return Math.max(2000, ...configs.map(estimateSystemPreviewDurationMs));
}
