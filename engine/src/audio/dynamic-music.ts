import { Sound } from '@babylonjs/core';
import type { AudioBus } from './audio-bus';
import type { MusicEntry, MusicLayerDef, MusicSetDef } from './audio-types';
import type { MusicTrackRegistry } from './music-track-registry';

interface ActiveLayer {
  def: MusicLayerDef;
  sound: Sound;
  baseVolume: number;
}

/**
 * Crysis / Rogue Squadron style adaptive score — multiple looping stems
 * mixed by a smoothed combat-intensity value (0 = calm, 1 = combat).
 */
export class DynamicMusicController {
  private activeSet: MusicSetDef | null = null;
  private activeLayers: ActiveLayer[] = [];
  private intensity = 0;
  private smoothedIntensity = 0;
  private usingHysteresis = false;
  private duckFactor = 1;

  constructor(
    private readonly bus: AudioBus,
    private readonly tracks: MusicTrackRegistry
  ) {}

  startSet(set: MusicSetDef, musicCatalog: Record<string, MusicEntry>): void {
    this.stop(0);
    this.activeSet = set;
    this.intensity = 0;
    this.smoothedIntensity = 0;
    this.usingHysteresis = false;
    this.activeLayers = [];

    for (const layer of set.layers) {
      const entry = musicCatalog[layer.id];
      const sound = this.tracks.get(layer.id);
      if (!entry || !sound) {
        console.warn(`[Audio] dynamic music missing layer: ${layer.id}`);
        continue;
      }

      const baseVolume = layer.volume ?? entry.volume;
      sound.setVolume(0);
      sound.play();
      this.activeLayers.push({ def: layer, sound, baseVolume });
    }

    this.applyLayerVolumes();
  }

  setIntensity(value: number, dt: number): void {
    if (!this.activeSet || this.activeLayers.length === 0) return;

    const set = this.activeSet;
    const attack = set.attackThreshold ?? 0.35;
    const release = set.releaseThreshold ?? 0.15;
    const smoothing = set.smoothing ?? 2.2;

    let target = Math.max(0, Math.min(1, value));
    if (this.usingHysteresis) {
      if (target < release) this.usingHysteresis = false;
    } else if (target > attack) {
      this.usingHysteresis = true;
    }

    const combatMix = this.usingHysteresis
      ? Math.max(target, attack)
      : target * (target / Math.max(attack, 0.001));

    this.intensity = combatMix;
    const alpha = Math.min(1, smoothing * dt);
    this.smoothedIntensity += (this.intensity - this.smoothedIntensity) * alpha;
    this.applyLayerVolumes();
  }

  duck(factor: number): void {
    this.duckFactor = factor;
    this.applyLayerVolumes();
  }

  unduck(): void {
    this.duckFactor = 1;
    this.applyLayerVolumes();
  }

  applyBusVolume(): void {
    this.applyLayerVolumes();
  }

  stop(fadeMs = 400): void {
    if (this.activeLayers.length === 0) return;

    if (fadeMs <= 0) {
      for (const layer of this.activeLayers) layer.sound.stop();
      this.activeLayers = [];
      this.activeSet = null;
      return;
    }

    const layers = [...this.activeLayers];
    this.activeLayers = [];
    this.activeSet = null;
    const start = performance.now();
    const startVols = layers.map((l) => l.sound.getVolume());

    const tick = (): void => {
      const t = Math.min(1, (performance.now() - start) / fadeMs);
      layers.forEach((layer, i) => {
        layer.sound.setVolume(startVols[i] * (1 - t));
        if (t >= 1) layer.sound.stop();
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  isActive(): boolean {
    return this.activeSet !== null;
  }

  dispose(): void {
    this.stop(0);
  }

  private applyLayerVolumes(): void {
    const bus = this.bus.effectiveMusic() * this.duckFactor;
    const mix = this.smoothedIntensity;

    for (const layer of this.activeLayers) {
      const weight =
        layer.def.role === 'combat' || layer.def.role === 'tension'
          ? mix
          : 1 - mix;
      layer.sound.setVolume(bus * layer.baseVolume * weight);
    }
  }
}
