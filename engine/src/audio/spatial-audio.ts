import { Vector3, type Sound } from '@babylonjs/core';
import type { AudioClipDef, AudioLibraryCategory } from './audio-types';

export interface SpatialAudioSettings {
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  distanceModel: string;
  doppler: boolean;
}

/** Game-world speed of sound (units/s), tuned for fighter-scale distances. */
export const SPEED_OF_SOUND = 340;

const DEFAULT_SPATIAL: SpatialAudioSettings = {
  refDistance: 10,
  maxDistance: 220,
  rolloffFactor: 1.1,
  distanceModel: 'inverse',
  doppler: true,
};

const SPATIAL_PRESETS = {
  weapon: { refDistance: 6, maxDistance: 170, rolloffFactor: 1.2 },
  explosion: { refDistance: 18, maxDistance: 400, rolloffFactor: 1.0 },
  hit: { refDistance: 8, maxDistance: 150, rolloffFactor: 1.15 },
  engine: { refDistance: 14, maxDistance: 260, rolloffFactor: 1.05 },
  flyby: { refDistance: 8, maxDistance: 220, rolloffFactor: 1.25 },
} as const satisfies Record<string, Partial<SpatialAudioSettings>>;

function presetForClip(def: AudioClipDef, category?: AudioLibraryCategory): Partial<SpatialAudioSettings> {
  if (def.loop) return SPATIAL_PRESETS.engine;
  if (category === 'engine') return SPATIAL_PRESETS.engine;
  const id = def.registry ?? '';
  if (id.includes('explosion') || id.includes('asteroid')) return SPATIAL_PRESETS.explosion;
  if (id.includes('cannon') || id.includes('projectile')) return SPATIAL_PRESETS.weapon;
  if (id.includes('inbound') || id.includes('whoosh')) return SPATIAL_PRESETS.flyby;
  if (id.includes('hit') || id.includes('bullet')) return SPATIAL_PRESETS.hit;
  return {};
}

export function resolveSpatialSettings(
  def: AudioClipDef,
  category?: AudioLibraryCategory
): SpatialAudioSettings | null {
  if (def.spatial === false || category === 'ui') return null;

  const preset = presetForClip(def, category);
  return {
    refDistance: def.refDistance ?? preset.refDistance ?? DEFAULT_SPATIAL.refDistance,
    maxDistance: def.maxDistance ?? preset.maxDistance ?? DEFAULT_SPATIAL.maxDistance,
    rolloffFactor: def.rolloffFactor ?? preset.rolloffFactor ?? DEFAULT_SPATIAL.rolloffFactor,
    distanceModel: def.distanceModel ?? preset.distanceModel ?? DEFAULT_SPATIAL.distanceModel,
    doppler: def.doppler ?? preset.doppler ?? DEFAULT_SPATIAL.doppler,
  };
}

export function configureSpatialSound(sound: Sound, settings: SpatialAudioSettings): void {
  sound.spatialSound = true;
  sound.refDistance = settings.refDistance;
  sound.maxDistance = settings.maxDistance;
  sound.rolloffFactor = settings.rolloffFactor;
  sound.distanceModel = settings.distanceModel;
  sound.switchPanningModelToHRTF();
}

/** Doppler pitch multiplier from relative radial velocity (approach raises pitch). */
export function computeDopplerPitch(
  sourcePos: Vector3,
  sourceVel: Vector3,
  listenerPos: Vector3,
  listenerVel: Vector3,
  speedOfSound = SPEED_OF_SOUND
): number {
  const offset = listenerPos.subtract(sourcePos);
  const distSq = offset.lengthSquared();
  if (distSq < 1e-4) return 1;

  const dir = offset.scale(1 / Math.sqrt(distSq));
  const relativeVel = sourceVel.subtract(listenerVel);
  const radialSpeed = Vector3.Dot(relativeVel, dir);
  const denom = speedOfSound - radialSpeed;
  if (Math.abs(denom) < 1) return 1;
  return Math.max(0.5, Math.min(2, speedOfSound / denom));
}
