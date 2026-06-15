import type { AssetManifest } from '@rogue-leader/engine';
import { ShipIds } from '../../data/constants/ships';

export interface SelectableShipInfo {
  shipId: string;
  displayName: string;
  faction: 'rebel' | 'imperial' | 'neutral';
  factionLabel: string;
}

/** Ships the player may choose at spawn (faction is derived — not user-selectable). */
export const PLAYABLE_SHIP_IDS: readonly string[] = [
  ShipIds.Xwing,
  ShipIds.TieFighter,
];

const SHIP_DISPLAY_NAMES: Record<string, string> = {
  [ShipIds.Xwing]: 'X-Wing',
  [ShipIds.TieFighter]: 'TIE Fighter',
};

const FACTION_LABELS: Record<string, string> = {
  rebel: 'Rebel Alliance',
  imperial: 'Galactic Empire',
  neutral: 'Independent',
};

export function listSelectableShips(manifest: AssetManifest): SelectableShipInfo[] {
  const ships: SelectableShipInfo[] = [];
  for (const shipId of PLAYABLE_SHIP_IDS) {
    const entry = manifest.ships[shipId];
    if (!entry?.lod) continue;
    const faction = entry.faction ?? 'neutral';
    ships.push({
      shipId,
      displayName: SHIP_DISPLAY_NAMES[shipId] ?? shipId,
      faction,
      factionLabel: FACTION_LABELS[faction] ?? faction,
    });
  }
  return ships;
}

export function collectSelectableShipIds(manifest: AssetManifest): string[] {
  return listSelectableShips(manifest).map((ship) => ship.shipId);
}
