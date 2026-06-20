import type { AssetManifest, PropManifestEntry, ShipManifestEntry } from '../loaders/asset-manifest';

export function resolveShipDeathPrefabId(entry: ShipManifestEntry): string | undefined {
  const id = entry.deathPrefabId?.trim();
  return id || undefined;
}

export function resolvePropDeathPrefabId(
  entry: PropManifestEntry,
  missionOverride?: string,
): string | undefined {
  const override = missionOverride?.trim();
  if (override) return override;
  const id = entry.deathPrefabId?.trim();
  return id || undefined;
}

export function collectDeathPrefabIds(
  shipIds: readonly string[],
  manifest: AssetManifest,
  options?: {
    asteroidPropId?: string;
    asteroidDeathPrefabOverride?: string;
  },
): string[] {
  const ids = new Set<string>();

  for (const shipId of shipIds) {
    const entry = manifest.ships[shipId];
    if (!entry) continue;
    const prefabId = resolveShipDeathPrefabId(entry);
    if (prefabId) ids.add(prefabId);
  }

  if (options?.asteroidPropId) {
    const propEntry = manifest.props[options.asteroidPropId];
    if (propEntry) {
      const prefabId = resolvePropDeathPrefabId(
        propEntry,
        options.asteroidDeathPrefabOverride,
      );
      if (prefabId) ids.add(prefabId);
    }
  }

  return [...ids];
}
