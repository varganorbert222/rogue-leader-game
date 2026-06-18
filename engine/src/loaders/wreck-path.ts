import type { ShipManifestEntry } from './asset-manifest';
import { resolveLodPlan } from './lod-config';

/** Derive wreck GLB path from ship LOD (`*_LOD0.glb` → `*_x_LOD0.glb`) or manifest override. */
export function resolveWreckPath(entry: ShipManifestEntry): string | null {
  if (entry.wreck) return entry.wreck;

  const plan = resolveLodPlan(entry.lod);
  const basePath = plan.levels.find((level) => level.kind === 'manual' && level.path)?.path;
  if (!basePath) return null;

  if (/_x_LOD/i.test(basePath)) return basePath;
  if (!/_LOD/i.test(basePath)) return null;

  return basePath.replace(/_LOD/i, '_x_LOD');
}

/** Derive prop wreck GLB from variant path (`asteroid_01.glb` → `asteroid_01_x.glb`). */
export function resolvePropWreckPath(variantPath: string): string {
  return variantPath.replace(/\.glb$/i, '_x.glb');
}
