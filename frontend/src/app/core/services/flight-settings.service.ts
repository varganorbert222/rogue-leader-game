import { Injectable } from '@angular/core';
import {
  loadFlightPreferences,
  saveFlightPreferences,
  type FlightPreferences,
} from '@rogue-leader/game';

@Injectable({ providedIn: 'root' })
export class FlightSettingsService {
  private settings: FlightPreferences = loadFlightPreferences();

  get(): FlightPreferences {
    return { ...this.settings };
  }

  update(partial: Partial<FlightPreferences>): FlightPreferences {
    this.settings = saveFlightPreferences(partial);
    return this.get();
  }

  reload(): FlightPreferences {
    this.settings = loadFlightPreferences();
    return this.get();
  }
}
