import { DevConfigPaths } from './dev-config-paths';
import type { LodManifestValue } from '../loaders/lod-config';

export async function loadLodEditorOverride(modelId: string): Promise<LodManifestValue | null> {
  try {
    const res = await fetch(DevConfigPaths.lodEditor.shipConfig(modelId));
    if (!res.ok) return null;
    return (await res.json()) as LodManifestValue;
  } catch {
    return null;
  }
}
