import type { MountedWeapon } from '../../combat/weapons/mounted-weapon';
import type { ResolvedShipWeaponGroup } from './ship-weapons-config';
import type { WeaponEnergyComponent } from '../../ecs/components/weapon-energy-component';

export type WeaponFiringMode = 'full' | 'pair' | 'sequential';

export interface WeaponFiringSelection {
  mounts: MountedWeapon[];
  mode: WeaponFiringMode;
  pairCount: number;
}

function defaultCrossPairSequence(slotIds: string[]): string[][] {
  const half = Math.ceil(slotIds.length / 2);
  const pairs: string[][] = [];
  for (let i = 0; i < half; i++) {
    const pair = [slotIds[i]];
    const cross = slotIds[i + half];
    if (cross !== undefined) {
      pair.push(cross);
    }
    pairs.push(pair);
  }
  return pairs;
}

/** Resolve pair steps for active slots; filters configured pairs to mounts that exist. */
export function resolvePairSequenceForSlots(
  activeSlotIds: string[],
  configured?: string[][],
): string[][] {
  if (configured && configured.length > 0) {
    const active = new Set(activeSlotIds);
    const resolved = configured
      .map((pair) => pair.filter((slotId) => active.has(slotId)))
      .filter((pair) => pair.length > 0);
    if (resolved.length > 0) return resolved;
  }
  return defaultCrossPairSequence(activeSlotIds);
}

export function selectMountsForEnergyLevel(
  weapons: MountedWeapon[],
  ready: MountedWeapon[],
  energy: WeaponEnergyComponent,
  group: ResolvedShipWeaponGroup,
): WeaponFiringSelection {
  const empty: WeaponFiringSelection = { mounts: [], mode: 'sequential', pairCount: 0 };
  const { slotIds, pairSequence } = group;
  const bySlot = new Map(weapons.map((w) => [w.mount.slotId, w]));
  const readySet = new Set(ready);

  const orderedReady = slotIds
    .map((slotId) => bySlot.get(slotId))
    .filter((w): w is MountedWeapon => w != null && readySet.has(w));

  if (orderedReady.length === 0) return empty;

  const fraction = energy.fraction;

  if (fraction >= group.fullFireThreshold) {
    return { mounts: orderedReady, mode: 'full', pairCount: 0 };
  }

  if (energy.isGroupFireCooldownActive(group.id)) {
    return empty;
  }

  if (fraction > group.pairThreshold) {
    const pairs =
      pairSequence.length > 0
        ? pairSequence
        : defaultCrossPairSequence(slotIds);
    const pairIndex = energy.getPairCursor(group.id) % pairs.length;
    const activePair = pairs[pairIndex] ?? [];

    const firing = activePair
      .map((slotId) => bySlot.get(slotId))
      .filter((w): w is MountedWeapon => w != null && readySet.has(w));

    return { mounts: firing, mode: 'pair', pairCount: pairs.length };
  }

  const orderIndex = energy.getSequentialCursor(group.id) % slotIds.length;
  const slotId = slotIds[orderIndex];
  const candidate = bySlot.get(slotId);
  if (!candidate || !readySet.has(candidate)) {
    return empty;
  }

  return { mounts: [candidate], mode: 'sequential', pairCount: 0 };
}
