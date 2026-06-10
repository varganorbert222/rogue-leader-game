import { Injectable } from '@angular/core';

const STORAGE_KEY = 'rogue-leader-flight';

export interface FlightSettings {
  autoRoll: boolean;
}

const DEFAULTS: FlightSettings = {
  autoRoll: true,
};

@Injectable({ providedIn: 'root' })
export class FlightSettingsService {
  private settings: FlightSettings = this.load();

  get(): FlightSettings {
    return { ...this.settings };
  }

  update(partial: Partial<FlightSettings>): FlightSettings {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    return this.get();
  }

  private load(): FlightSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<FlightSettings>;
      return { autoRoll: parsed.autoRoll ?? DEFAULTS.autoRoll };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
