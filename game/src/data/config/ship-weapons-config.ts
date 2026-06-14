import type { ShipManifestEntry } from "@rogue-leader/engine";
import type {
  ShipWeaponDefinitionPatch,
  ShipWeaponEnergyManifest,
  ShipWeaponGroupManifest,
} from "@rogue-leader/engine";

/** Code defaults when ship manifest omits weapon tuning. */
export const DEFAULT_WEAPON_GROUP_ENERGY = {
  energyCost: 2,
  pairThreshold: 0.9,
  fullFireThreshold: 1.0,
  fireRateSec: 0.05,
} as const;

export const DEFAULT_SHIP_WEAPON_ENERGY: Required<ShipWeaponEnergyManifest> = {
  maxEnergy: 100,
  regenPerSec: 18,
  regenDelaySec: 0.85,
};

/** Normalized ship weapon configuration (legacy fields + `weapons` block merged). */
export interface ResolvedShipWeaponsConfig {
  defaults: Partial<Record<"laser" | "projectile", string>>;
  slotBindings: Record<string, string>;
  slotOverrides: Record<string, ShipWeaponDefinitionPatch>;
  definitions: Record<string, ShipWeaponDefinitionPatch>;
  groups: ShipWeaponGroupManifest[];
  energy: ShipWeaponEnergyManifest;
}

/** Runtime weapon group after mount assignment and default resolution. */
export interface ResolvedShipWeaponGroup {
  id: string;
  fireInput: "primary" | "secondary";
  slotIds: string[];
  usesEnergy: boolean;
  energyCost: number;
  pairThreshold: number;
  fullFireThreshold: number;
  pairSequence: string[][];
  /** Minimum seconds between volleys; resolved from weapon cooldownSec unless overridden. */
  fireRateSec: number;
  ammo?: number;
  ammoWeaponId?: string;
}

export interface MountGroupAssignment {
  groupId: string;
  indexInGroup: number;
}

export interface ShipWeaponEnergyPoolConfig {
  maxEnergy: number;
  regenPerSec: number;
  regenDelaySec: number;
}

export function resolveShipWeaponsConfig(
  shipEntry: ShipManifestEntry,
): ResolvedShipWeaponsConfig {
  const weapons = shipEntry.weapons;
  const slotBindings: Record<string, string> = {
    ...shipEntry.anchors?.weapons,
  };
  const slotOverrides: Record<string, ShipWeaponDefinitionPatch> = {};

  for (const [slotId, binding] of Object.entries(weapons?.slots ?? {})) {
    if (typeof binding === "string") {
      slotBindings[slotId] = binding;
    } else {
      slotBindings[slotId] = binding.weapon;
      if (binding.overrides) {
        slotOverrides[slotId] = binding.overrides;
      }
    }
  }

  return {
    defaults: {
      ...shipEntry.defaultWeapons,
      ...weapons?.defaults,
    },
    slotBindings,
    slotOverrides,
    definitions: weapons?.definitions ?? {},
    groups: weapons?.groups ?? shipEntry.weaponGroups ?? [],
    energy: {
      ...shipEntry.weaponEnergy,
      ...weapons?.energy,
    },
  };
}

export function resolveShipWeaponEnergyPool(
  shipWeapons: ResolvedShipWeaponsConfig,
): ShipWeaponEnergyPoolConfig {
  return {
    maxEnergy:
      shipWeapons.energy.maxEnergy ?? DEFAULT_SHIP_WEAPON_ENERGY.maxEnergy,
    regenPerSec:
      shipWeapons.energy.regenPerSec ?? DEFAULT_SHIP_WEAPON_ENERGY.regenPerSec,
    regenDelaySec:
      shipWeapons.energy.regenDelaySec ??
      DEFAULT_SHIP_WEAPON_ENERGY.regenDelaySec,
  };
}

export function collectShipWeaponIds(shipEntry: ShipManifestEntry): string[] {
  const config = resolveShipWeaponsConfig(shipEntry);
  const ids = new Set<string>();

  for (const weaponId of Object.values(config.defaults)) {
    if (weaponId) ids.add(weaponId);
  }
  for (const weaponId of Object.values(config.slotBindings)) {
    if (weaponId) ids.add(weaponId);
  }
  for (const weaponId of Object.keys(config.definitions)) {
    ids.add(weaponId);
    const extendsId = config.definitions[weaponId]?.extends;
    if (extendsId) ids.add(extendsId);
  }
  for (const group of config.groups) {
    if (group.weaponId) ids.add(group.weaponId);
  }

  return [...ids];
}

export function resolvePlayerAmmoMagazines(
  shipGroups: ResolvedShipWeaponGroup[],
  shipWeapons: ResolvedShipWeaponsConfig,
): Record<string, number> {
  const magazines: Record<string, number> = {};

  for (const [weaponId, def] of Object.entries(shipWeapons.definitions)) {
    if (def.ammo !== undefined) {
      magazines[weaponId] = def.ammo;
    }
  }

  for (const group of shipGroups) {
    if (group.ammo !== undefined && group.ammoWeaponId) {
      magazines[group.ammoWeaponId] = group.ammo;
    }
  }

  return magazines;
}
