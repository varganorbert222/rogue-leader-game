import type { AssetManifest } from '../loaders/asset-manifest';
import { resolveLodPlan } from '../loaders/lod-config';
import { resolvePropWreckPath, resolveWreckPath } from '../loaders/wreck-path';
import type { LodEditorModelEntry, LodEditorModelVariant } from './lod-editor-types';

function variantFromGlbPath(path: string): LodEditorModelVariant {
  const label = path.split('/').pop()?.replace(/\.glb$/i, '') ?? path;
  return { id: label, label, glbPath: path };
}

function isWreckGlbPath(path: string): boolean {
  return /_x(?:_LOD|\.glb)/i.test(path);
}

function wreckPropVariant(variant: LodEditorModelVariant): LodEditorModelVariant | null {
  if (isWreckGlbPath(variant.glbPath)) return null;
  const wreckPath = resolvePropWreckPath(variant.glbPath);
  const id = wreckPath.split('/').pop()?.replace(/\.glb$/i, '') ?? `${variant.id}_x`;
  return { id, label: `${variant.label} (destroyed)`, glbPath: wreckPath };
}

function extendPropVariants(
  variants: LodEditorModelVariant[] | undefined,
): LodEditorModelVariant[] | undefined {
  if (!variants?.length) return variants;

  const existingIds = new Set(variants.map((variant) => variant.id));
  const wreckExtras: LodEditorModelVariant[] = [];
  for (const variant of variants) {
    const wreck = wreckPropVariant(variant);
    if (wreck && !existingIds.has(wreck.id)) {
      wreckExtras.push(wreck);
      existingIds.add(wreck.id);
    }
  }

  return wreckExtras.length ? [...variants, ...wreckExtras] : variants;
}

function propVariantsFromLod(
  lod: LodEditorModelEntry['lod'],
): LodEditorModelVariant[] | undefined {
  const plan = resolveLodPlan(lod);
  const basePath = plan.levels.find((level) => level.kind === 'manual' && level.path)?.path;
  if (!basePath || isWreckGlbPath(basePath)) return undefined;
  return extendPropVariants([variantFromGlbPath(basePath)]);
}

function createShipWreckEntry(
  id: string,
  ship: AssetManifest['ships'][string],
): LodEditorModelEntry | null {
  if (id.endsWith('_x')) return null;
  const wreckPath = resolveWreckPath(ship);
  if (!wreckPath) return null;

  return {
    id: `${id}_x`,
    kind: 'ship',
    label: `Ship · ${id} (destroyed)`,
    scale: ship.scale,
    lod: { mode: 'none', basePath: wreckPath },
  };
}

/** Full manifest model catalog — ships, props, and derived `_x` wreck entries. */
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

    const wreckEntry = createShipWreckEntry(id, ship);
    if (wreckEntry) entries.push(wreckEntry);
  }

  for (const [id, prop] of Object.entries(manifest.props)) {
    const variants =
      extendPropVariants(prop.variants?.map(variantFromGlbPath)) ??
      propVariantsFromLod(prop.lod);
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
