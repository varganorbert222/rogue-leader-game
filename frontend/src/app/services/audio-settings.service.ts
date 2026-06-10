import { Injectable } from '@angular/core';

const STORAGE_KEY = 'rogue-leader-audio';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

const DEFAULTS: AudioSettings = {
  master: 0.85,
  music: 0.6,
  sfx: 0.8,
  muted: false,
};

@Injectable({ providedIn: 'root' })
export class AudioSettingsService {
  private settings: AudioSettings = this.load();

  get(): AudioSettings {
    return { ...this.settings };
  }

  update(partial: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    return this.get();
  }

  private load(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
