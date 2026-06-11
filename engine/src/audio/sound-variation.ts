import type { Sound } from '@babylonjs/core';

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Best-effort pitch via HTML5 playbackRate or Web Audio playbackRate. */
export function applySoundPitch(sound: Sound, pitch: number): void {
  const clamped = Math.max(0.5, Math.min(2, pitch));
  const internal = sound as unknown as {
    _htmlAudioElement?: HTMLAudioElement;
    _soundPanner?: { _soundSource?: AudioBufferSourceNode };
  };

  const html = internal._htmlAudioElement;
  if (html) {
    html.playbackRate = clamped;
    return;
  }

  const source = internal._soundPanner?._soundSource;
  if (source?.playbackRate) {
    source.playbackRate.value = clamped;
  }
}

export function resolveVolumeVariation(
  base: number,
  range?: [number, number],
  scale = 1
): number {
  if (!range) return base * scale;
  return randomInRange(range[0], range[1]) * base * scale;
}

export function resolvePitchVariation(
  range?: [number, number],
  override?: number
): number {
  if (override !== undefined) return override;
  if (!range) return 1;
  return randomInRange(range[0], range[1]);
}
