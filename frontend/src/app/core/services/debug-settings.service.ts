import { Injectable } from '@angular/core';
import {
  cloneDebugPreferences,
  loadDebugPreferences,
  saveDebugPreferences,
  type DebugPreferences,
} from '@rogue-leader/game';

@Injectable({ providedIn: 'root' })
export class DebugSettingsService {
  private settings: DebugPreferences = loadDebugPreferences();

  get(): DebugPreferences {
    return cloneDebugPreferences(this.settings);
  }

  update(partial: Partial<DebugPreferences>): DebugPreferences {
    this.settings = saveDebugPreferences(partial);
    return this.get();
  }

  reload(): DebugPreferences {
    this.settings = loadDebugPreferences();
    return this.get();
  }
}
