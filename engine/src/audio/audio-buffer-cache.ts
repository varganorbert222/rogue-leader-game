import { AbstractEngine, Scene, Sound } from '@babylonjs/core';

type SoundCreationOptions = {
  loop?: boolean;
  autoplay?: boolean;
  volume?: number;
  spatialSound?: boolean;
  maxDistance?: number;
  refDistance?: number;
  rolloffFactor?: number;
  distanceModel?: string;
};

export class AudioBufferCache {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private readonly failedUrls = new Set<string>();
  private readonly trackedSounds = new Set<Sound>();
  private silentBuffer: AudioBuffer | null = null;

  getIfReady(url: string): AudioBuffer | undefined {
    return this.buffers.get(url);
  }

  isFailed(url: string): boolean {
    return this.failedUrls.has(url);
  }

  createSound(
    name: string,
    url: string,
    scene: Scene,
    options: SoundCreationOptions,
    afterCreate?: (sound: Sound) => void
  ): Sound {
    const cached = this.buffers.get(url);
    if (cached) {
      const sound = new Sound(name, cached, scene, undefined, options);
      afterCreate?.(sound);
      return sound;
    }

    const ctx = AbstractEngine.audioEngine?.audioContext;
    if (this.failedUrls.has(url)) {
      if (ctx) {
        const sound = new Sound(name, this.getSilentBuffer(ctx), scene, undefined, {
          ...options,
          volume: 0,
        });
        afterCreate?.(sound);
        return sound;
      }
      const sound = new Sound(name, url, scene, undefined, options);
      afterCreate?.(sound);
      return sound;
    }

    if (!ctx) {
      const sound = new Sound(name, url, scene, undefined, options);
      afterCreate?.(sound);
      return sound;
    }

    const sound = new Sound(name, this.getSilentBuffer(ctx), scene, undefined, {
      ...options,
      volume: 0,
    });
    afterCreate?.(sound);
    this.trackedSounds.add(sound);

    void this.ensureLoaded(url).then((buffer) => {
      if (!buffer || !this.trackedSounds.has(sound)) return;
      const targetVolume = options.volume ?? 1;
      const wasPlaying = sound.isPlaying;
      sound.stop();
      sound.setAudioBuffer(buffer);
      sound.setVolume(targetVolume);
      afterCreate?.(sound);
      if (wasPlaying) sound.play();
    });

    return sound;
  }

  ensureLoaded(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return Promise.resolve(cached);
    if (this.failedUrls.has(url)) return Promise.resolve(null);

    let pending = this.pending.get(url);
    if (!pending) {
      pending = this.load(url);
      this.pending.set(url, pending);
    }
    return pending;
  }

  warmUrls(urls: readonly string[]): Promise<void> {
    const unique = [...new Set(urls.filter(Boolean))];
    return Promise.all(unique.map((url) => this.ensureLoaded(url))).then(() => undefined);
  }

  untrack(sound: Sound): void {
    this.trackedSounds.delete(sound);
  }

  dispose(): void {
    this.trackedSounds.clear();
    this.buffers.clear();
    this.pending.clear();
    this.failedUrls.clear();
    this.silentBuffer = null;
  }

  private async load(url: string): Promise<AudioBuffer | null> {
    const ctx = AbstractEngine.audioEngine?.audioContext;
    if (!ctx) {
      console.warn('[Audio] AudioContext not available — skipping preload:', url);
      this.markFailed(url);
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[Audio] Missing audio file (HTTP ${response.status}): ${url}`);
        this.markFailed(url);
        return null;
      }

      const data = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      this.buffers.set(url, buffer);
      this.pending.delete(url);
      return buffer;
    } catch (err) {
      console.warn(`[Audio] Failed to load audio: ${url}`, err);
      this.markFailed(url);
      return null;
    }
  }

  private markFailed(url: string): void {
    this.failedUrls.add(url);
    this.pending.delete(url);
  }

  private getSilentBuffer(ctx: AudioContext): AudioBuffer {
    if (this.silentBuffer) return this.silentBuffer;
    this.silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    return this.silentBuffer;
  }
}
