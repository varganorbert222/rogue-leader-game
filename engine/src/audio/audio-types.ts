/** Semantic categories for audio libraries (Unity AudioMixer-group style). */
export type AudioLibraryCategory =
  | 'sfx'
  | 'music'
  | 'ambient'
  | 'engine'
  | 'ui';

export interface MusicEntry {
  path: string;
  loop: boolean;
  volume: number;
}

export interface LegacySfxEntry {
  path: string;
  volume: number;
  cooldownMs?: number;
}

/** Per-clip definition inside a library folder. */
export interface AudioClipDef {
  /** Filenames relative to the library basePath (or registry group path). */
  files?: string[];
  /** Reference into assets/audio/sfx/registry.json → groups. */
  registry?: string;
  volume?: number;
  volumeRange?: [number, number];
  pitchRange?: [number, number];
  cooldownMs?: number;
  maxVoices?: number;
  loop?: boolean;
  /** When false, plays as stereo (UI). Defaults to spatial for non-ui libraries. */
  spatial?: boolean;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
  distanceModel?: string;
  /** Apply Doppler pitch shift from source/listener velocity. */
  doppler?: boolean;
}

export interface SfxRegistryGroup {
  basePath: string;
  files: string[];
}

export interface SfxRegistry {
  version?: number;
  preferredFormats?: string[];
  groups: Record<string, SfxRegistryGroup>;
}

export interface AudioLibraryDef {
  id: string;
  category: AudioLibraryCategory;
  basePath: string;
  clips: Record<string, AudioClipDef>;
  /** Map external ids (e.g. weapon manifest) to clip keys in this library. */
  aliases?: Record<string, string>;
}

export interface MusicLayerDef {
  id: string;
  role: 'calm' | 'combat' | 'tension';
  volume?: number;
}

export interface MusicSetDef {
  layers: MusicLayerDef[];
  crossfadeMs?: number;
  /** Intensity must exceed this to ramp combat layers up. */
  attackThreshold?: number;
  /** Intensity must fall below this to ramp combat layers down. */
  releaseThreshold?: number;
  /** Smoothing speed toward target intensity (1/s). */
  smoothing?: number;
}

export interface EngineAudioDef {
  /** Playback pitch at minimum ship speed (T = 0). */
  speedPitchMin?: number;
  /** Playback pitch at maximum ship speed (T = 1). */
  speedPitchMax?: number;
}

export interface AudioManifest {
  version?: number;
  music: Record<string, MusicEntry>;
  /** Flat legacy one-shot registry — still supported. */
  sfx?: Record<string, LegacySfxEntry>;
  /** Relative paths to library JSON files. */
  libraries?: Record<string, string>;
  musicSets?: Record<string, MusicSetDef>;
  engineAudio?: EngineAudioDef;
}

import type { Vector3 } from '@babylonjs/core';

export interface PlayOneShotOptions {
  volume?: number;
  pitch?: number;
  cooldownMs?: number;
  /** World position for spatial playback. */
  position?: Vector3;
  /** Source velocity for Doppler (units/s). */
  velocity?: Vector3;
  /** Override clip spatial flag — false forces stereo. */
  spatial?: boolean;
}

export interface StartLoopOptions {
  volumeScale?: number;
  pitch?: number;
  position?: Vector3;
  velocity?: Vector3;
}

export interface LoopTransformOptions {
  volumeScale?: number;
  pitch?: number;
  position?: Vector3;
  velocity?: Vector3;
}
