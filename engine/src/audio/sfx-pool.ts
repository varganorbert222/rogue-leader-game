import { Scene, Sound } from '@babylonjs/core';
import type { AudioBus } from './audio-bus';

export interface SfxEntry {
  path: string;
  volume: number;
  cooldownMs?: number;
}

export class SfxPool {
  private readonly sounds = new Map<string, Sound>();
  private readonly lastPlayed = new Map<string, number>();

  constructor(
    private readonly scene: Scene,
    private readonly bus: AudioBus
  ) {}

  register(id: string, entry: SfxEntry, baseUrl: string): void {
    const url = `${baseUrl}/${entry.path}`.replace(/\/+/g, '/').replace(':/', '://');
    const sound = new Sound(
      id,
      url,
      this.scene,
      undefined,
      { loop: false, autoplay: false, volume: entry.volume }
    );
    this.sounds.set(id, sound);
  }

  play(id: string, volumeScale = 1, cooldownMs?: number): void {
    const sound = this.sounds.get(id);
    if (!sound) return;

    const now = performance.now();
    const cd = cooldownMs ?? 0;
    const last = this.lastPlayed.get(id) ?? 0;
    if (cd > 0 && now - last < cd) return;

    this.lastPlayed.set(id, now);
    sound.setVolume(this.bus.effectiveSfx() * volumeScale);
    if (sound.isPlaying) sound.stop();
    sound.play();
  }

  dispose(): void {
    for (const sound of this.sounds.values()) {
      sound.dispose();
    }
    this.sounds.clear();
  }
}
