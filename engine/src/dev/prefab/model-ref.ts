import type { AssetManifest } from '../../loaders/asset-manifest';
import { resolveModelVariantPath, type LodEditorModelEntry } from '../lod-editor-types';
import { listLodEditorModels } from '../lod-manifest-models';
import type { PrefabModelRef } from './types';

export function resolvePrefabModelGlbPath(
  modelRef: PrefabModelRef,
  models: readonly LodEditorModelEntry[],
): string | null {
  const entry = models.find((m) => m.id === modelRef.modelId);
  if (!entry) return null;
  const variantId = modelRef.variantId ?? entry.variants?.[0]?.id ?? '';
  const variantPath = variantId ? resolveModelVariantPath(entry, variantId) : undefined;
  if (variantPath) return variantPath;
  if (Array.isArray(entry.lod) && entry.lod.length > 0) {
    return entry.lod[0];
  }
  if (entry.lod && !Array.isArray(entry.lod) && typeof entry.lod === 'object' && 'basePath' in entry.lod) {
    return entry.lod.basePath ?? null;
  }
  return null;
}

export function resolvePrefabModelScale(
  modelRef: PrefabModelRef,
  models: readonly LodEditorModelEntry[],
  manifest: AssetManifest,
): number | [number, number] | [number, number, number] {
  const entry = models.find((m) => m.id === modelRef.modelId);
  if (entry) return entry.scale;
  const ship = manifest.ships[modelRef.modelId];
  if (ship) return ship.scale;
  const prop = manifest.props[modelRef.modelId];
  if (prop) return prop.scale;
  return 1;
}

export { listLodEditorModels } from '../lod-manifest-models';
