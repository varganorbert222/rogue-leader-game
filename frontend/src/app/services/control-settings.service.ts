import { Injectable } from '@angular/core';
import {
  cloneControlBindings,
  loadControlBindings,
  saveControlBindings,
  resetControlBindings,
  type ControlBindingsConfig,
} from '@rogue-leader/game';

@Injectable({ providedIn: 'root' })
export class ControlSettingsService {
  private settings: ControlBindingsConfig = loadControlBindings();

  get(): ControlBindingsConfig {
    return cloneControlBindings(this.settings);
  }

  update(config: ControlBindingsConfig): ControlBindingsConfig {
    this.settings = saveControlBindings(config);
    return this.get();
  }

  reload(): ControlBindingsConfig {
    this.settings = loadControlBindings();
    return this.get();
  }

  reset(): ControlBindingsConfig {
    this.settings = resetControlBindings();
    return this.get();
  }
}
