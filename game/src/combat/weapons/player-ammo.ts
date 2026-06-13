/** Limited magazines for player secondary / projectile weapons. NPCs ignore this. */
export class PlayerAmmoStore {
  private readonly counts = new Map<string, number>();

  constructor(initial: Record<string, number>) {
    for (const [weaponId, count] of Object.entries(initial)) {
      this.counts.set(weaponId, Math.max(0, count));
    }
  }

  getCount(weaponId: string): number {
    return this.counts.get(weaponId) ?? 0;
  }

  /** Total remaining projectile rounds across all tracked magazines. */
  getTotalProjectileAmmo(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  canFire(weaponId: string): boolean {
    if (!this.counts.has(weaponId)) {
      return true;
    }
    return this.getCount(weaponId) > 0;
  }

  consume(weaponId: string): boolean {
    if (!this.counts.has(weaponId)) {
      return true;
    }
    const remaining = this.getCount(weaponId);
    if (remaining <= 0) {
      return false;
    }
    this.counts.set(weaponId, remaining - 1);
    return true;
  }
}
