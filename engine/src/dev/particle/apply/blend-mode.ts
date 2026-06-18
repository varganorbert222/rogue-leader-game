import { ParticleSystem } from '@babylonjs/core';
import type { ParticleBlendMode, ParticleSystemEditable } from '../types';
import { applyParticleEmission } from './emission';
import { applyAlphaBlendParticleEffect } from './alpha-blend';

export function resolveBlendMode(mode: ParticleBlendMode): number {
  switch (mode) {
    case 'alpha':
      return ParticleSystem.BLENDMODE_STANDARD;
    case 'multiply':
      return ParticleSystem.BLENDMODE_MULTIPLY;
    case 'oneone':
      return ParticleSystem.BLENDMODE_ONEONE;
    case 'add':
    default:
      return ParticleSystem.BLENDMODE_ADD;
  }
}

export function normalizeAlphaCutoff(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(1, raw));
}

export function applyParticleBlendSettings(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  scene: import('@babylonjs/core').Scene,
): void {
  ps.blendMode = resolveBlendMode(config.blendMode);

  if (config.blendMode === 'alpha') {
    ps.textureMask.a = 1;
  }

  const alphaCutoff = normalizeAlphaCutoff(config.alphaCutoff);
  applyParticleEmission(ps, config, scene, alphaCutoff);

  if (config.blendMode === 'alpha' && !config.emission.textureId) {
    applyAlphaBlendParticleEffect(ps, alphaCutoff);
  }
}
