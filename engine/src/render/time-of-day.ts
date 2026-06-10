import type { Scene } from '@babylonjs/core';

/**
 * Part B: 0–24h skybox blend + cloud overlays.
 * MVP uses static skybox only.
 */
export class TimeOfDayService {
  private hour = 12;

  constructor(_scene: Scene) {}

  setHour(hour: number): void {
    this.hour = hour;
    // TODO Part B: blend cubemaps and cloud layers
  }

  getHour(): number {
    return this.hour;
  }

  update(_dt: number): void {
    // stub
  }
}
