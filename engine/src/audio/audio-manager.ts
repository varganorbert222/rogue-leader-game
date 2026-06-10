import type { Scene } from '@babylonjs/core';
import { AudioBus } from './audio-bus';
import { MusicController } from './music-controller';
import { SfxPool } from './sfx-pool';

export interface AudioManifest {
  music: Record<string, { path: string; loop: boolean; volume: number }>;
  sfx: Record<string, { path: string; volume: number; cooldownMs?: number }>;
}

const warnedMissing = new Set<string>();

export class AudioManager {
  readonly bus = new AudioBus();
  private readonly music: MusicController;
  private readonly sfx: SfxPool;
  private unlocked = false;
  private manifest: AudioManifest | null = null;

  constructor(private readonly scene: Scene) {
    this.music = new MusicController(scene, this.bus);
    this.sfx = new SfxPool(scene, this.bus);
  }

  async loadManifest(url: string, baseUrl = '/assets'): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.manifest = (await res.json()) as AudioManifest;
      for (const [id, entry] of Object.entries(this.manifest.music)) {
        this.music.register(id, entry, baseUrl);
      }
      for (const [id, entry] of Object.entries(this.manifest.sfx)) {
        this.sfx.register(id, entry, baseUrl);
      }
    } catch (err) {
      console.warn('[Audio] manifest load failed — SFX/music will no-op', err);
      this.manifest = { music: {}, sfx: {} };
    }
  }

  async unlock(): Promise<void> {
    this.unlocked = true;
  }

  setMasterVolume(v: number): void {
    this.bus.master = Math.max(0, Math.min(1, v));
    this.music.applyBusVolume();
  }

  setMusicVolume(v: number): void {
    this.bus.music = Math.max(0, Math.min(1, v));
    this.music.applyBusVolume();
  }

  setSfxVolume(v: number): void {
    this.bus.sfx = Math.max(0, Math.min(1, v));
  }

  setMuted(muted: boolean): void {
    this.bus.muted = muted;
    this.music.applyBusVolume();
  }

  playMusic(id: string, options?: { fadeInMs?: number }): void {
    if (!this.unlocked) return;
    if (!this.manifest?.music[id] && !warnedMissing.has(`music:${id}`)) {
      warnedMissing.add(`music:${id}`);
      console.warn(`[Audio] missing music id: ${id}`);
      return;
    }
    this.music.play(id, options?.fadeInMs ?? 0);
  }

  stopMusic(fadeOutMs = 0): void {
    this.music.stop(fadeOutMs);
  }

  crossfadeMusic(toId: string, durationMs: number): void {
    if (!this.unlocked) return;
    this.music.crossfade(toId, durationMs);
  }

  duckMusic(factor = 0.35): void {
    this.music.duck(factor);
  }

  unduckMusic(): void {
    this.music.unduck();
  }

  playSfx(id: string, options?: { volume?: number; cooldownMs?: number }): void {
    if (!this.unlocked) return;
    const entry = this.manifest?.sfx[id];
    if (!entry && !warnedMissing.has(`sfx:${id}`)) {
      warnedMissing.add(`sfx:${id}`);
      console.warn(`[Audio] missing sfx id: ${id}`);
      return;
    }
    this.sfx.play(id, options?.volume ?? 1, options?.cooldownMs ?? entry?.cooldownMs);
  }

  dispose(): void {
    this.music.dispose();
    this.sfx.dispose();
  }
}
