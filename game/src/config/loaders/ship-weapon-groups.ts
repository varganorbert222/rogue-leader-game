import type { DetectedWeaponMount, ShipWeaponGroupManifest } from '@rogue-leader/engine';
import type { MountWeaponBinding } from '../../combat/weapons/weapon-registry';
import type { MountedWeapon } from '../../combat/weapons/mounted-weapon';
import {
  DEFAULT_WEAPON_GROUP_ENERGY,
  type MountGroupAssignment,
  type ResolvedShipWeaponGroup,
  type ResolvedShipWeaponsConfig,
} from './ship-weapons-config';
import { resolvePairSequenceForSlots } from './weapon-firing-pattern';

export type { MountGroupAssignment, ResolvedShipWeaponGroup } from './ship-weapons-config';

/** Resolve group fire rate from manifest override or weapon cooldownSec values. */
export function resolveGroupFireRateSec(
  weapons: MountedWeapon[],
  manifestOverride?: number,
): number {
  if (manifestOverride !== undefined && manifestOverride > 0) {
    return manifestOverride;
  }
  if (weapons.length === 0) {
    return DEFAULT_WEAPON_GROUP_ENERGY.fireRateSec;
  }
  return Math.max(...weapons.map((w) => w.definition.cooldownSec));
}

/** Unique key when laser and projectile mounts share the same slot id (e.g. both `"01"`). */
export function mountAssignmentKey(mount: DetectedWeaponMount): string {
  return `${mount.delivery}:${mount.slotId}`;
}

function bindingForMount(
  mount: DetectedWeaponMount,
  bindings: MountWeaponBinding[],
): MountWeaponBinding | undefined {
  return bindings.find((b) => b.mount === mount);
}

function defaultEnergyGroupFields(
  overrides: Partial<
    Pick<
      ResolvedShipWeaponGroup,
      'energyCost' | 'pairThreshold' | 'fullFireThreshold' | 'fireRateSec'
    >
  > = {},
): Pick<
  ResolvedShipWeaponGroup,
  'energyCost' | 'pairThreshold' | 'fullFireThreshold' | 'fireRateSec'
> {
  return {
    energyCost:
      overrides.energyCost ?? DEFAULT_WEAPON_GROUP_ENERGY.energyCost,
    pairThreshold:
      overrides.pairThreshold ?? DEFAULT_WEAPON_GROUP_ENERGY.pairThreshold,
    fullFireThreshold:
      overrides.fullFireThreshold ??
      DEFAULT_WEAPON_GROUP_ENERGY.fullFireThreshold,
    fireRateSec: overrides.fireRateSec ?? 0,
  };
}

export function resolveShipWeaponGroups(
  shipWeapons: ResolvedShipWeaponsConfig,
  mounts: DetectedWeaponMount[],
  bindings: MountWeaponBinding[],
): {
  groups: ResolvedShipWeaponGroup[];
  assignments: Map<string, MountGroupAssignment>;
} {
  const hasManifestGroups = shipWeapons.groups.length > 0;
  const groups = hasManifestGroups
    ? shipWeapons.groups.map((g) => createResolvedGroup(g, bindings))
    : autoGenerateGroups(mounts, bindings);

  const assignments = new Map<string, MountGroupAssignment>();
  const assigned = new Set<string>();

  for (const group of groups) {
    assignMountsToGroup(group, mounts, bindings, assignments, assigned);
  }

  if (!hasManifestGroups) {
    assignOrphanMounts(mounts, bindings, groups, assignments, assigned);
  }

  return { groups, assignments };
}

function createResolvedGroup(
  manifest: ShipWeaponGroupManifest,
  bindings: MountWeaponBinding[],
): ResolvedShipWeaponGroup {
  const usesEnergy = manifest.usesEnergy ?? inferUsesEnergy(manifest);
  const slotIds = [...manifest.slots];
  const ammoWeaponId =
    manifest.weaponId ??
    findProjectileWeaponId(slotIds, bindings.map((b) => b.mount), bindings);

  return {
    id: manifest.id,
    fireInput: manifest.fireInput,
    slotIds,
    usesEnergy,
    ...defaultEnergyGroupFields({
      energyCost: manifest.energyCost,
      pairThreshold: manifest.pairThreshold,
      fullFireThreshold: manifest.fullFireThreshold,
      fireRateSec: manifest.fireRateSec ?? 0,
    }),
    pairSequence: manifest.pairSequence ?? [],
    ammo: manifest.ammo,
    ammoWeaponId: usesEnergy ? undefined : ammoWeaponId,
  };
}

function assignMountsToGroup(
  group: ResolvedShipWeaponGroup,
  mounts: DetectedWeaponMount[],
  bindings: MountWeaponBinding[],
  assignments: Map<string, MountGroupAssignment>,
  assigned: Set<string>,
): void {
  const resolvedSlots: string[] = [];

  for (const slotId of group.slotIds) {
    const mount = findMountForGroupSlot(mounts, slotId, group, assigned);
    if (!mount) continue;
    resolvedSlots.push(mount.slotId);
    const key = mountAssignmentKey(mount);
    assignments.set(key, {
      groupId: group.id,
      indexInGroup: resolvedSlots.length - 1,
    });
    assigned.add(key);
  }

  const extras = mounts
    .filter(
      (m) =>
        !assigned.has(mountAssignmentKey(m)) && mountMatchesGroup(m, group, bindings),
    )
    .sort((a, b) => compareSlotIds(a.slotId, b.slotId));

  for (const mount of extras) {
    resolvedSlots.push(mount.slotId);
    const key = mountAssignmentKey(mount);
    assignments.set(key, {
      groupId: group.id,
      indexInGroup: resolvedSlots.length - 1,
    });
    assigned.add(key);
  }

  group.slotIds = resolvedSlots;
  group.pairSequence = resolvePairSequenceForSlots(
    resolvedSlots,
    group.pairSequence.length > 0 ? group.pairSequence : undefined,
  );

  if (!group.usesEnergy && group.ammoWeaponId === undefined) {
    group.ammoWeaponId = findProjectileWeaponId(resolvedSlots, mounts, bindings);
  }
}

function findMountForGroupSlot(
  mounts: DetectedWeaponMount[],
  slotId: string,
  group: ResolvedShipWeaponGroup,
  assigned: Set<string>,
): DetectedWeaponMount | undefined {
  return mounts.find(
    (mount) =>
      mount.slotId === slotId &&
      !assigned.has(mountAssignmentKey(mount)) &&
      mountMatchesGroupDelivery(mount, group),
  );
}

function assignOrphanMounts(
  mounts: DetectedWeaponMount[],
  bindings: MountWeaponBinding[],
  groups: ResolvedShipWeaponGroup[],
  assignments: Map<string, MountGroupAssignment>,
  assigned: Set<string>,
): void {
  for (const mount of mounts) {
    if (assigned.has(mountAssignmentKey(mount))) continue;
    const binding = bindingForMount(mount, bindings);
    const delivery = binding?.definition.delivery ?? mount.delivery;
    const fallbackId =
      delivery === 'laser' ? '__auto_primary_lasers' : '__auto_secondary_projectiles';
    let group = groups.find((g) => g.id === fallbackId);
    if (!group) {
      group = {
        id: fallbackId,
        fireInput: delivery === 'laser' ? 'primary' : 'secondary',
        slotIds: [],
        usesEnergy: delivery === 'laser',
        pairSequence: [],
        ...defaultEnergyGroupFields({
          energyCost: delivery === 'laser' ? undefined : 0,
        }),
      };
      groups.push(group);
    }
    group.slotIds.push(mount.slotId);
    const key = mountAssignmentKey(mount);
    assignments.set(key, {
      groupId: group.id,
      indexInGroup: group.slotIds.length - 1,
    });
    assigned.add(key);
    group.pairSequence = resolvePairSequenceForSlots(group.slotIds);
  }
}

function mountMatchesGroup(
  mount: DetectedWeaponMount,
  group: ResolvedShipWeaponGroup,
  bindings: MountWeaponBinding[],
): boolean {
  const binding = bindingForMount(mount, bindings);
  const delivery = binding?.definition.delivery ?? mount.delivery;
  return deliveryMatchesGroupFireInput(delivery, group);
}

function mountMatchesGroupDelivery(
  mount: DetectedWeaponMount,
  group: ResolvedShipWeaponGroup,
): boolean {
  return deliveryMatchesGroupFireInput(mount.delivery, group);
}

function deliveryMatchesGroupFireInput(
  delivery: DetectedWeaponMount['delivery'],
  group: ResolvedShipWeaponGroup,
): boolean {
  if (group.fireInput === 'primary') return delivery === 'laser';
  if (group.fireInput === 'secondary') return delivery === 'projectile';
  return false;
}

function inferUsesEnergy(manifest: ShipWeaponGroupManifest): boolean {
  if (manifest.usesEnergy !== undefined) return manifest.usesEnergy;
  return manifest.fireInput === 'primary';
}

function autoGenerateGroups(
  mounts: DetectedWeaponMount[],
  bindings: MountWeaponBinding[],
): ResolvedShipWeaponGroup[] {
  const lasers = sortMounts(mounts.filter((m) => m.delivery === 'laser'));
  const projectiles = sortMounts(
    mounts.filter((m) => m.delivery === 'projectile'),
  );
  const groups: ResolvedShipWeaponGroup[] = [];

  if (lasers.length > 0) {
    const slotIds = lasers.map((m) => m.slotId);
    groups.push({
      id: 'primary_lasers',
      fireInput: 'primary',
      slotIds,
      usesEnergy: true,
      pairSequence: resolvePairSequenceForSlots(slotIds),
      ...defaultEnergyGroupFields(),
    });
  }

  if (projectiles.length > 0) {
    const slotIds = projectiles.map((m) => m.slotId);
    groups.push({
      id: 'secondary_projectiles',
      fireInput: 'secondary',
      slotIds,
      usesEnergy: false,
      pairSequence: resolvePairSequenceForSlots(slotIds),
      ...defaultEnergyGroupFields({ energyCost: 0 }),
      ammoWeaponId: findProjectileWeaponId(slotIds, projectiles, bindings),
    });
  }

  return groups;
}

function findProjectileWeaponId(
  slotIds: string[],
  mounts: DetectedWeaponMount[],
  bindings: MountWeaponBinding[],
): string | undefined {
  for (const slotId of slotIds) {
    const mount = mounts.find(
      (m) => m.slotId === slotId && m.delivery === 'projectile',
    );
    if (!mount) continue;
    const binding = bindingForMount(mount, bindings);
    if (binding?.definition.delivery === 'projectile') {
      return binding.definition.id;
    }
  }
  return undefined;
}

function sortMounts(mounts: DetectedWeaponMount[]): DetectedWeaponMount[] {
  return [...mounts].sort((a, b) => compareSlotIds(a.slotId, b.slotId));
}

function compareSlotIds(a: string, b: string): number {
  const numA = parseInt(a.replace(/\D/g, ''), 10);
  const numB = parseInt(b.replace(/\D/g, ''), 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a.localeCompare(b);
}
