import type { AssetManifest } from '../loaders/asset-manifest';
import type { LodEditorModelEntry, LodEditorModelVariant } from './lod-editor-types';

function variantFromGlbPath(path: string): LodEditorModelVariant {
  const label = path.split('/').pop()?.replace(/\.glb$/i, '') ?? path;
  return { id: label, label, glbPath: path };
}

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
    const variants = prop.variants?.map(variantFromGlbPath);
    entries.push({
      id,
      kind: 'prop',
      label: `Prop · ${id}`,
      scale: prop.scale,
      lod:
        prop.lod ??
        (variants?.length
          ? { mode: 'none' as const, basePath: variants[0].glbPath }
          : undefined),
      variants,
    });
  }

  entries.sort((a, b) => a.label.localeCompare(b.label));
  return entries;
}
