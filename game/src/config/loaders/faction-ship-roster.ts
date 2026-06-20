import type { AssetManifest } from '@rogue-leader/engine';
import { areFactionsHostile, resolveFaction, type FactionId } from '../../combat/faction';
import { ShipIds } from '../constants/ships';

/**
 * Equivalent hulls on opposing factions — extend when adding new ship pairs.
 * Mission waves author the default hostile hull; this table swaps when the
 * player flies the same faction.
 */
const FACTION_COUNTERPART_PAIRS: readonly (readonly [string, string])[] = [
  [ShipIds.Xwing, ShipIds.TieFighter],
];

const counterpartByShipId = new Map<string, string>(
  FACTION_COUNTERPART_PAIRS.flatMap(([a, b]) => [
    [a, b] as const,
    [b, a] as const,
  ]),
);

export function resolveFactionCounterpartShipId(shipId: string): string | undefined {
  return counterpartByShipId.get(shipId);
}

/**
 * Resolve a wave enemy ship for the current player faction.
 * When the configured hull matches the player's faction, return the paired
 * hostile counterpart (e.g. TIE → X-Wing when the player is imperial).
 */
export function resolveWaveEnemyShipId(
  configuredShipId: string,
  playerFaction: FactionId,
  manifest: AssetManifest,
): string {
  const entry = manifest.ships[configuredShipId];
  if (!entry) return configuredShipId;

  const shipFaction = resolveFaction(entry.faction);
  if (areFactionsHostile(playerFaction, shipFaction)) {
    return configuredShipId;
  }

  const counterpart = resolveFactionCounterpartShipId(configuredShipId);
  if (counterpart && manifest.ships[counterpart]) {
    return counterpart;
  }

  return configuredShipId;
}
