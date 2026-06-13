import { Scene, Sound } from '@babylonjs/core';
import type { MusicEntry } from './audio-types';
import type { AudioBufferCache } from './audio-buffer-cache';
import { warmSound } from './sound-warmup';

export class MusicTrackRegistry {
  private readonly tracks = new Map<string, Sound>();
  private readonly trackUrls = new Map<string, string>();

  constructor(
    private readonly scene: Scene,
    private readonly bufferCache: AudioBufferCache
  ) {}

  register(id: string, entry: MusicEntry, baseUrl: string): Sound {
    const existing = this.tracks.get(id);
    if (existing) return existing;

    const url = `${baseUrl}/${entry.path}`.replace(/\/+/g, '/').replace(':/', '://');
    const sound = this.bufferCache.createSound(`music_${id}`, url, this.scene, {
      loop: entry.loop,
      autoplay: false,
      volume: entry.volume,
    });

    this.tracks.set(id, sound);
    this.trackUrls.set(id, url);
    return sound;
  }

  get(id: string): Sound | undefined {
    return this.tracks.get(id);
  }

  warmTracks(ids: readonly string[]): Promise<void> {
    const unique = [...new Set(ids.filter(Boolean))];
    const urls = unique
      .map((id) => this.trackUrls.get(id))
      .filter((url): url is string => !!url);

    return this.bufferCache.warmUrls(urls).then(() =>
      Promise.all(
        unique.map((id) => {
          const track = this.tracks.get(id);
          return track ? warmSound(track) : Promise.resolve();
        })
      ).then(() => undefined)
    );
  }

  dispose(): void {
    for (const track of this.tracks.values()) {
      this.bufferCache.untrack(track);
      track.dispose();
    }
    this.tracks.clear();
    this.trackUrls.clear();
  }
}
