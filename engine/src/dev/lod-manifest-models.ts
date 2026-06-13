import type { AssetManifest } from '../loaders/asset-manifest';
import type { LodEditorModelEntry } from './lod-editor-types';

export function listLodEditorModels(manifest: AssetManifest): LodEditorModelEntry[] {
  const entries: LodEditorModelEntry[] = [];

  for (const [id, ship] of Object.entries(manifest.ships)) {
    entries.push({
      id,
      kind: 'ship',
      label: `Ship · ${id}`,
      scale: ship.scale,
      lod: ship.lod,
    });
  }

  for (const [id, prop] of Object.entries(manifest.props)) {
    entries.push({
      id,
      kind: 'prop',
      label: `Prop · ${id}`,
      scale: prop.scale,
      lod: prop.lod ?? (prop.variants?.length ? { mode: 'none' as const } : undefined),
    });
  }

  entries.sort((a, b) => a.label.localeCompare(b.label));
  return entries;
}
