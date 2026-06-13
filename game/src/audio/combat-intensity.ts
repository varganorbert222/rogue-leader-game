import { Vector3 } from "@babylonjs/core";
import {
  DamageSeverities,
  type DamageSeverity,
} from "../constants/damage-severity";

export interface CombatIntensitySnapshot {
  enemyCount: number;
  enemiesInRadar: number;
  enemiesInAttackRange: number;
  playerFiring: boolean;
  playerThrottle: number;
}

/** Smoothed 0–1 combat dynamism for adaptive music and future mix buses. */
export class CombatIntensityTracker {
  private intensity = 0;
  private damageBurst = 0;

  notifyDamage(severity: DamageSeverity): void {
    const add =
      severity === DamageSeverities.Hull
        ? 1
        : severity === DamageSeverities.Asteroid
          ? 0.85
          : 0.65;
    this.damageBurst = Math.max(this.damageBurst, add);
  }

  update(dt: number, snapshot: CombatIntensitySnapshot): number {
    let target = 0;

    if (snapshot.enemyCount > 0) target += 0.12;
    target += Math.min(snapshot.enemiesInRadar * 0.18, 0.45);
    target += Math.min(snapshot.enemiesInAttackRange * 0.22, 0.55);
    if (snapshot.playerFiring) target += 0.14;
    target = Math.max(target, this.damageBurst);

    this.damageBurst = Math.max(0, this.damageBurst - dt * 0.45);

    const rising = target > this.intensity;
    const rate = rising ? 2.8 : 0.75;
    this.intensity += (target - this.intensity) * Math.min(1, rate * dt);
    return this.intensity;
  }

  getIntensity(): number {
    return this.intensity;
  }

  reset(): void {
    this.intensity = 0;
    this.damageBurst = 0;
  }
}

export function distanceBetween(a: Vector3, b: Vector3): number {
  return Vector3.Distance(a, b);
}
