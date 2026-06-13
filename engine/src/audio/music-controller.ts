import { Sound } from '@babylonjs/core';
import type { AudioBus } from './audio-bus';
import type { MusicTrackRegistry } from './music-track-registry';

export class MusicController {
  private currentId: string | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly bus: AudioBus,
    private readonly tracks: MusicTrackRegistry
  ) {}

  play(id: string, fadeInMs = 0): void {
    const next = this.tracks.get(id);
    if (!next) return;

    if (this.currentId === id && next.isPlaying) return;

    const prev = this.currentId ? this.tracks.get(this.currentId) : undefined;
    this.currentId = id;

    if (prev && prev.isPlaying) {
      prev.stop();
    }

    next.setVolume(this.bus.effectiveMusic() * (fadeInMs > 0 ? 0 : 1));
    next.play();

    if (fadeInMs > 0) {
      this.fadeTo(next, this.bus.effectiveMusic(), fadeInMs);
    }
  }

  crossfade(toId: string, durationMs: number): void {
    const prev = this.currentId ? this.tracks.get(this.currentId) : undefined;
    const next = this.tracks.get(toId);
    if (!next) return;

    this.currentId = toId;
    next.setVolume(0);
    next.play();

    const start = performance.now();
    const fromVol = prev?.getVolume() ?? 0;
    const target = this.bus.effectiveMusic();

    this.clearFade();
    this.fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      next.setVolume(target * t);
      if (prev) prev.setVolume(fromVol * (1 - t));
      if (t >= 1) {
        if (prev) prev.stop();
        this.clearFade();
      }
    }, 16);
  }

  stop(fadeOutMs = 0): void {
    if (!this.currentId) return;
    const current = this.tracks.get(this.currentId);
    if (!current) return;

    if (fadeOutMs <= 0) {
      current.stop();
      this.currentId = null;
      return;
    }

    const startVol = current.getVolume();
    const start = performance.now();
    this.clearFade();
    this.fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / fadeOutMs);
      current.setVolume(startVol * (1 - t));
      if (t >= 1) {
        current.stop();
        this.currentId = null;
        this.clearFade();
      }
    }, 16);
  }

  duck(factor: number): void {
    if (!this.currentId) return;
    const track = this.tracks.get(this.currentId);
    track?.setVolume(this.bus.effectiveMusic() * factor);
  }

  unduck(): void {
    if (!this.currentId) return;
    const track = this.tracks.get(this.currentId);
    track?.setVolume(this.bus.effectiveMusic());
  }

  applyBusVolume(): void {
    if (!this.currentId) return;
    const track = this.tracks.get(this.currentId);
    track?.setVolume(this.bus.effectiveMusic());
  }

  dispose(): void {
    this.clearFade();
    this.currentId = null;
  }

  private fadeTo(sound: Sound, target: number, durationMs: number): void {
    const start = performance.now();
    this.clearFade();
    this.fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      sound.setVolume(target * t);
      if (t >= 1) this.clearFade();
    }, 16);
  }

  private clearFade(): void {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}
