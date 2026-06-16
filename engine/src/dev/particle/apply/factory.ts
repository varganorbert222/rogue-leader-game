import { Color4, ParticleSystem, Vector3, type Scene } from '@babylonjs/core';
import type { Color4Editable } from '../../shared/editable-primitives';
import { isAnimatedParticleAtlas, syncStaticAtlasCell } from '../albedo-atlas';
import type { ParticleBlendMode, ParticleSystemEditable } from '../types';
import { applyEmissionDuration } from '../playback';
import {
  babylonUpdateSpeed,
  mpsToEmitPower,
} from '../units';
import { resolveParticleTextureUrlById } from '../textures/catalog';
import { getWhiteParticleTexture, resolveAlbedoParticleTexture } from '../textures/resolver';
import { applyParticleEmissionEffect, applyParticleEmissionTint } from './emission';
import { applyParticleShape } from './shape';
import { applyRotationOverLifetime } from './rotation-lifetime';
import { applySizeOverLifetime } from './size-lifetime';

function toColor4(c: Color4Editable): Color4 {
  return new Color4(c.r, c.g, c.b, c.a);
}

function resolveBlendMode(mode: ParticleBlendMode): number {
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

function applyAlbedoTexture(ps: ParticleSystem, config: ParticleSystemEditable, scene: Scene): void {
  const albedo = syncStaticAtlasCell(config.albedoTexture);
  const texture = resolveAlbedoParticleTexture(scene, albedo);
  ps.particleTexture = texture;

  const useAtlas = !!albedo.textureId && albedo.isAtlas;
  ps.isAnimationSheetEnabled = useAtlas;

  if (!useAtlas) {
    return;
  }

  ps.spriteCellWidth = Math.max(1, albedo.tileWidth);
  ps.spriteCellHeight = Math.max(1, albedo.tileHeight);

  if (isAnimatedParticleAtlas(albedo)) {
    ps.startSpriteCellID = albedo.startCellIndex;
    ps.endSpriteCellID = albedo.endCellIndex;
    ps.spriteCellChangeSpeed = Math.max(0, albedo.animationSpeed);
    ps.spriteCellLoop = albedo.animationLoop;
  } else {
    const cell = albedo.cellIndex;
    ps.startSpriteCellID = cell;
    ps.endSpriteCellID = cell;
    ps.spriteCellChangeSpeed = 0;
    ps.spriteCellLoop = false;
  }

  ps.spriteRandomStartCell = false;
}

function applyEmission(ps: ParticleSystem, config: ParticleSystemEditable, scene: Scene): void {
  const emissionUrl = config.emission.textureId
    ? resolveParticleTextureUrlById(config.emission.textureId)
    : null;

  if (emissionUrl) {
    if (!ps.particleTexture) {
      ps.particleTexture = getWhiteParticleTexture(scene);
    }
    applyParticleEmissionEffect(ps, {
      emissionTint: config.emission.color,
      emissionTextureUrl: emissionUrl,
    });
    applyParticleEmissionTint(ps, config.emission.color, false);
    return;
  }

  ps.setCustomEffect(null, ps.blendMode);
  applyParticleEmissionTint(ps, config.emission.color, true);
}

export function applyEditableToParticleSystem(
  ps: ParticleSystem,
  config: ParticleSystemEditable,
  scene: Scene,
): void {
  ps.name = config.name;
  ps.preventAutoStart = true;

  applyAlbedoTexture(ps, config, scene);
  applyEmission(ps, config, scene);
  applyParticleShape(ps, config.shape);

  ps.color1 = toColor4(config.color1);
  ps.color2 = toColor4(config.color2);
  ps.colorDead = toColor4(config.colorDead);
  ps.minSize = config.minSize;
  ps.maxSize = config.maxSize;
  applySizeOverLifetime(ps, config);
  ps.minLifeTime = config.minLifeTime;
  ps.maxLifeTime = config.maxLifeTime;
  ps.emitRate = config.emitRate;
  applyEmissionDuration(ps, config);
  ps.blendMode = resolveBlendMode(config.blendMode);
  ps.gravity = new Vector3(config.gravity.x, config.gravity.y, config.gravity.z);
  applyRotationOverLifetime(ps, config);
  ps.minEmitPower = mpsToEmitPower(config.minStartSpeedMps, config.playbackSpeed);
  ps.maxEmitPower = mpsToEmitPower(config.maxStartSpeedMps, config.playbackSpeed);
  ps.updateSpeed = babylonUpdateSpeed(config.playbackSpeed);
  ps.startDelay = config.startDelay;
  ps.disposeOnStop = false;
}

export function createParticleSystemFromEditable(
  scene: Scene,
  config: ParticleSystemEditable,
): ParticleSystem {
  const albedo = config.albedoTexture;
  const needsSheet = !!albedo.textureId && albedo.isAtlas;
  const ps = new ParticleSystem(config.name, config.capacity, scene, null, needsSheet);
  applyEditableToParticleSystem(ps, config, scene);
  return ps;
}
