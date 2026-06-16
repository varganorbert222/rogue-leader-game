import { mergeColor4, mergeVec3 } from '../shared/editable-primitives';
import { syncAlbedoTextureFromCatalog } from './textures/catalog';
import { syncStaticAtlasCell } from './albedo-atlas';
import {
  normalizeRotationOverLifetime,
  normalizeSizeOverLifetime,
} from './curves';
import { defaultParticleSystem } from './defaults';
import type { ParticleEffectEditable, ParticleSystemEditable } from './types';

export function normalizeParticleSystem(
  system: Partial<ParticleSystemEditable> & { name: string; id?: string },
): ParticleSystemEditable {
  const defaults = defaultParticleSystem(system.name);
  const shapeDefaults = defaults.shape;
  const shapePatch = system.shape;

  const merged: ParticleSystemEditable = {
    ...defaults,
    ...system,
    id: system.id ?? defaults.id,
    shape: {
      ...shapeDefaults,
      ...shapePatch,
      type: shapePatch?.type ?? shapeDefaults.type,
      direction1: mergeVec3(shapeDefaults.direction1, shapePatch?.direction1),
      direction2: mergeVec3(shapeDefaults.direction2, shapePatch?.direction2),
      boxMin: mergeVec3(shapeDefaults.boxMin, shapePatch?.boxMin),
      boxMax: mergeVec3(shapeDefaults.boxMax, shapePatch?.boxMax),
      radius: shapePatch?.radius ?? shapeDefaults.radius,
      length: shapePatch?.length ?? shapeDefaults.length,
      tubeRadius: shapePatch?.tubeRadius ?? shapeDefaults.tubeRadius,
    },
    gravity: mergeVec3(defaults.gravity, system.gravity),
    minStartRotationDeg: mergeVec3(defaults.minStartRotationDeg, system.minStartRotationDeg),
    maxStartRotationDeg: mergeVec3(defaults.maxStartRotationDeg, system.maxStartRotationDeg),
    minRotationSpeedDeg: mergeVec3(defaults.minRotationSpeedDeg, system.minRotationSpeedDeg),
    maxRotationSpeedDeg: mergeVec3(defaults.maxRotationSpeedDeg, system.maxRotationSpeedDeg),
    rotationOverLifetime: normalizeRotationOverLifetime({
      ...defaults.rotationOverLifetime,
      ...system.rotationOverLifetime,
      keyframes:
        system.rotationOverLifetime?.keyframes ?? defaults.rotationOverLifetime.keyframes,
    }),
    color1: mergeColor4(defaults.color1, system.color1),
    color2: mergeColor4(defaults.color2, system.color2),
    colorDead: mergeColor4(defaults.colorDead, system.colorDead),
    sizeOverLifetime: normalizeSizeOverLifetime({
      ...defaults.sizeOverLifetime,
      ...system.sizeOverLifetime,
      keyframes: system.sizeOverLifetime?.keyframes ?? defaults.sizeOverLifetime.keyframes,
    }),
    albedoTexture: syncStaticAtlasCell(
      syncAlbedoTextureFromCatalog({ ...defaults.albedoTexture, ...system.albedoTexture }),
    ),
    emission: {
      ...defaults.emission,
      ...system.emission,
      color: mergeVec3(defaults.emission.color, system.emission?.color),
    },
  };

  if (merged.emissionMode === 'burst' && merged.looping && merged.duration <= 0) {
    merged.duration = Math.max(merged.maxLifeTime, 1);
  }

  return merged;
}

export function normalizeParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  return {
    ...effect,
    systems: effect.systems.map((system) => normalizeParticleSystem(system)),
  };
}

export function cloneParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  return normalizeParticleEffect(JSON.parse(JSON.stringify(effect)) as ParticleEffectEditable);
}
