import { AbstractEngine, type Scene, type Vector3 } from '@babylonjs/core';
import '@babylonjs/core/Audio/audioEngine';
import { loadAudioLibraries } from './audio-library-loader';
import { AudioBufferCache } from './audio-buffer-cache';
import { AudioBus } from './audio-bus';
import type {
  AudioManifest,
  EngineAudioDef,
  LoopTransformOptions,
  MusicSetDef,
  PlayOneShotOptions,
  StartLoopOptions,
  SfxRegistry,
} from './audio-types';
import { ClipPlayer } from './clip-player';
import {
  CockpitAudioFilter,
  type CockpitAudioFilterConfig,
} from './cockpit-audio-filter';
import { DynamicMusicController } from './dynamic-music';
import { MusicController } from './music-controller';
import { MusicTrackRegistry } from './music-track-registry';
import { loadSfxRegistry } from './sfx-registry';

export type {
  AudioManifest,
  LoopTransformOptions,
  PlayOneShotOptions,
  StartLoopOptions,
} from './audio-types';
export type { CockpitAudioFilterConfig } from './cockpit-audio-filter';

const warnedMissing = new Set<string>();

export class AudioManager {
  readonly bus = new AudioBus();
  private readonly bufferCache = new AudioBufferCache();
  private readonly musicTracks: MusicTrackRegistry;
  private readonly music: MusicController;
  private readonly dynamicMusic: DynamicMusicController;
  private readonly clips: ClipPlayer;
  private readonly cockpitFilter: CockpitAudioFilter;
  private unlocked = false;
  private manifest: AudioManifest | null = null;
  private musicSets: Record<string, MusicSetDef> = {};
  private assetsBaseUrl = '/assets';

  constructor(private readonly scene: Scene) {
    this.scene.audioEnabled = true;
    this.scene.audioPositioningRefreshRate = 0;
    this.musicTracks = new MusicTrackRegistry(scene, this.bufferCache);
    this.music = new MusicController(this.bus, this.musicTracks);
    this.dynamicMusic = new DynamicMusicController(this.bus, this.musicTracks);
    this.clips = new ClipPlayer(scene, this.bus, this.bufferCache);
    this.cockpitFilter = new CockpitAudioFilter();
  }

  async loadManifest(
    url: string,
    assetsBaseUrl = '/assets',
    configBaseUrl?: string,
  ): Promise<void> {
    this.assetsBaseUrl = assetsBaseUrl;
    const configBase = configBaseUrl ?? url.replace(/\/[^/]+$/, '');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.manifest = (await res.json()) as AudioManifest;
      this.musicSets = this.manifest.musicSets ?? {};

      for (const [id, entry] of Object.entries(this.manifest.music)) {
        this.musicTracks.register(id, entry, assetsBaseUrl);
      }

      if (this.manifest.sfx) {
        for (const [id, entry] of Object.entries(this.manifest.sfx)) {
          if (!this.clips.hasClip(id)) {
            this.clips.registerLegacy(id, entry, assetsBaseUrl);
          }
        }
      }

      const registry: SfxRegistry | null = await loadSfxRegistry(configBase);
      await loadAudioLibraries(
        this.manifest,
        this.clips,
        configBase,
        assetsBaseUrl,
        registry,
      );
    } catch (err) {
      console.warn('[Audio] manifest load failed — SFX/music will no-op', err);
      this.manifest = { music: {}, sfx: {} };
    }
  }

  async unlock(): Promise<void> {
    this.unlocked = true;
    const audioEngine = AbstractEngine.audioEngine;
    if (!audioEngine) return;
    audioEngine.useCustomUnlockedButton = true;
    audioEngine.unlock();
    this.cockpitFilter.setEnabled(this.cockpitFilter.isEnabled());
  }

  setCockpitMode(enabled: boolean): void {
    this.cockpitFilter.setEnabled(enabled);
  }

  isCockpitMode(): boolean {
    return this.cockpitFilter.isEnabled();
  }

  update(dt: number): void {
    this.cockpitFilter.update(dt);
  }

  /** Update listener state for Doppler (position follows active camera automatically). */
  updateListener(position: Vector3, velocity: Vector3): void {
    this.clips.setListenerState(position, velocity);
  }

  setMasterVolume(v: number): void {
    this.bus.master = Math.max(0, Math.min(1, v));
    this.music.applyBusVolume();
    this.dynamicMusic.applyBusVolume();
  }

  setMusicVolume(v: number): void {
    this.bus.music = Math.max(0, Math.min(1, v));
    this.music.applyBusVolume();
    this.dynamicMusic.applyBusVolume();
  }

  setSfxVolume(v: number): void {
    this.bus.sfx = Math.max(0, Math.min(1, v));
  }

  setMuted(muted: boolean): void {
    this.bus.muted = muted;
    this.music.applyBusVolume();
    this.dynamicMusic.applyBusVolume();
  }

  playOneShot(id: string, options?: PlayOneShotOptions): void {
    if (!this.unlocked) return;
    if (!this.clips.hasClip(id) && !warnedMissing.has(`clip:${id}`)) {
      warnedMissing.add(`clip:${id}`);
      console.warn(`[Audio] missing clip id: ${id}`);
      return;
    }
    this.clips.playOneShot(id, options);
  }

  playSfx(id: string, options?: PlayOneShotOptions): void {
    this.playOneShot(id, options);
  }

  playRandomFile(
    basePath: string,
    files: readonly string[],
    options?: PlayOneShotOptions
  ): void {
    if (!this.unlocked) return;
    this.clips.playRandomFile(basePath, files, this.assetsBaseUrl, options);
  }

  preloadFileVariants(basePath: string, files: readonly string[]): void {
    this.clips.preloadFileVariants(basePath, files, this.assetsBaseUrl);
  }

  warmMissionAudio(plan: {
    audioClipIds: readonly string[];
    musicId?: string;
    musicSetId?: string;
  }): Promise<void> {
    const musicIds = new Set<string>();
    if (plan.musicSetId) {
      const set = this.musicSets[plan.musicSetId];
      for (const layer of set?.layers ?? []) {
        musicIds.add(layer.id);
      }
    } else if (plan.musicId) {
      musicIds.add(plan.musicId);
    }

    return Promise.all([
      this.clips.warmClips(plan.audioClipIds),
      this.musicTracks.warmTracks([...musicIds]),
    ]).then(() => undefined);
  }

  startLoop(id: string, options?: StartLoopOptions | number): string {
    if (!this.unlocked) return '';
    if (typeof options === 'number') {
      return this.clips.startLoop(id, { volumeScale: options });
    }
    return this.clips.startLoop(id, options);
  }

  setLoopTransform(handle: string, options: LoopTransformOptions): void {
    this.clips.setLoopTransform(handle, options);
  }

  setLoopVolume(handle: string, volumeScale: number): void {
    this.clips.setLoopVolume(handle, volumeScale);
  }

  stopLoop(handle: string): void {
    this.clips.stopLoop(handle);
  }

  playMusic(id: string, options?: { fadeInMs?: number }): void {
    if (!this.unlocked) return;
    if (!this.manifest?.music[id] && !warnedMissing.has(`music:${id}`)) {
      warnedMissing.add(`music:${id}`);
      console.warn(`[Audio] missing music id: ${id}`);
      return;
    }
    this.dynamicMusic.stop(0);
    this.music.play(id, options?.fadeInMs ?? 0);
  }

  stopMusic(fadeOutMs = 0): void {
    this.dynamicMusic.stop(fadeOutMs);
    this.music.stop(fadeOutMs);
  }

  crossfadeMusic(toId: string, durationMs: number): void {
    if (!this.unlocked) return;
    this.dynamicMusic.stop(0);
    this.music.crossfade(toId, durationMs);
  }

  startMusicSet(setId: string): boolean {
    if (!this.unlocked) return false;
    const set = this.musicSets[setId];
    if (!set || !this.manifest) {
      if (!warnedMissing.has(`musicSet:${setId}`)) {
        warnedMissing.add(`musicSet:${setId}`);
        console.warn(`[Audio] missing music set: ${setId}`);
      }
      return false;
    }
    this.music.stop(0);
    this.dynamicMusic.startSet(set, this.manifest.music);
    return true;
  }

  setMusicIntensity(value: number, dt: number): void {
    if (!this.unlocked) return;
    this.dynamicMusic.setIntensity(value, dt);
  }

  isDynamicMusicActive(): boolean {
    return this.dynamicMusic.isActive();
  }

  getEngineAudioConfig(): EngineAudioDef | undefined {
    return this.manifest?.engineAudio;
  }

  duckMusic(factor = 0.35): void {
    this.music.duck(factor);
    this.dynamicMusic.duck(factor);
  }

  unduckMusic(): void {
    this.music.unduck();
    this.dynamicMusic.unduck();
  }

  dispose(): void {
    this.cockpitFilter.dispose();
    this.music.dispose();
    this.dynamicMusic.dispose();
    this.clips.dispose();
    this.musicTracks.dispose();
    this.bufferCache.dispose();
  }
}

