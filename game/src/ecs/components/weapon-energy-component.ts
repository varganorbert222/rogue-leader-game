import type {
  ResolvedShipWeaponGroup,
  ShipWeaponEnergyPoolConfig,
} from '../../config/loaders/ship-weapons-config';
import type { WeaponFiringMode } from '../../config/loaders/weapon-firing-pattern';

interface PendingSequenceAdvance {
  mode: Exclude<WeaponFiringMode, 'full'>;
  pairCount: number;
  slotCount: number;
}

export class WeaponEnergyComponent {
  energy: number;
  private regenBlocked = false;
  private regenPauseRemaining = 0;
  private readonly sequentialCursor = new Map<string, number>();
  private readonly pairCursor = new Map<string, number>();
  private readonly groupFireCooldownRemaining = new Map<string, number>();
  private readonly pendingSequenceAdvance = new Map<string, PendingSequenceAdvance>();

  constructor(
    private readonly pool: ShipWeaponEnergyPoolConfig,
    private readonly energyGroups: readonly ResolvedShipWeaponGroup[],
  ) {
    this.energy = pool.maxEnergy;
  }

  get maxEnergy(): number {
    return this.pool.maxEnergy;
  }

  get fraction(): number {
    return this.maxEnergy > 0 ? this.energy / this.maxEnergy : 0;
  }

  setRegenBlocked(blocked: boolean): void {
    this.regenBlocked = blocked;
  }

  endFrame(dt: number): void {
    this.tickGroupFireCooldowns(dt);

    if (this.regenPauseRemaining > 0) {
      this.regenPauseRemaining = Math.max(0, this.regenPauseRemaining - dt);
    }

    if (this.regenBlocked || this.regenPauseRemaining > 0) return;

    this.energy = Math.min(
      this.maxEnergy,
      this.energy + this.pool.regenPerSec * dt,
    );
  }

  canAffordCost(cost: number): boolean {
    return this.energy >= cost;
  }

  consumeCost(cost: number): void {
    if (cost <= 0) return;
    this.energy = Math.max(0, this.energy - cost);
    this.regenPauseRemaining = Math.max(
      this.regenPauseRemaining,
      this.pool.regenDelaySec,
    );
  }

  isGroupFireCooldownActive(groupId: string): boolean {
    return (this.groupFireCooldownRemaining.get(groupId) ?? 0) > 0;
  }

  scheduleGroupFireCooldown(
    groupId: string,
    mode: Exclude<WeaponFiringMode, 'full'>,
    pairCount: number,
    slotCount: number,
    fireRateSec: number,
  ): void {
    if (fireRateSec <= 0) {
      this.applySequenceAdvance(groupId, mode, pairCount, slotCount);
      return;
    }
    this.groupFireCooldownRemaining.set(groupId, fireRateSec);
    this.pendingSequenceAdvance.set(groupId, { mode, pairCount, slotCount });
  }

  getSequentialCursor(groupId: string): number {
    return this.sequentialCursor.get(groupId) ?? 0;
  }

  getPairCursor(groupId: string): number {
    return this.pairCursor.get(groupId) ?? 0;
  }

  private tickGroupFireCooldowns(dt: number): void {
    for (const [groupId, remaining] of [
      ...this.groupFireCooldownRemaining.entries(),
    ]) {
      const next = remaining - dt;
      if (next <= 0) {
        this.groupFireCooldownRemaining.delete(groupId);
        const pending = this.pendingSequenceAdvance.get(groupId);
        if (pending) {
          this.applySequenceAdvance(
            groupId,
            pending.mode,
            pending.pairCount,
            pending.slotCount,
          );
          this.pendingSequenceAdvance.delete(groupId);
        }
      } else {
        this.groupFireCooldownRemaining.set(groupId, next);
      }
    }
  }

  private applySequenceAdvance(
    groupId: string,
    mode: Exclude<WeaponFiringMode, 'full'>,
    pairCount: number,
    slotCount: number,
  ): void {
    if (mode === 'pair') {
      this.advancePairCursor(groupId, pairCount);
      return;
    }
    this.advanceSequentialCursor(groupId, slotCount);
  }

  private advancePairCursor(groupId: string, pairCount: number): void {
    if (pairCount <= 0) return;
    const next = ((this.pairCursor.get(groupId) ?? 0) + 1) % pairCount;
    this.pairCursor.set(groupId, next);
  }

  private advanceSequentialCursor(groupId: string, slotCount: number): void {
    if (slotCount <= 0) return;
    const next = ((this.sequentialCursor.get(groupId) ?? 0) + 1) % slotCount;
    this.sequentialCursor.set(groupId, next);
  }
}
