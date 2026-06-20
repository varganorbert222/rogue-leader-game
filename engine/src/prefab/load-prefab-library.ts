import { DevConfigPaths } from '../dev/dev-config-paths';
import { normalizePrefabEditable } from '../dev/prefab/refs';
import type { PrefabLibraryDocument, PrefabLibraryEntry } from '../dev/prefab/types';
import { RuntimePaths } from '../runtime-paths';

async function fetchPrefabLibrary(url: string): Promise<PrefabLibraryEntry[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as PrefabLibraryDocument;
    if (!json.prefabs?.length) return null;
    return json.prefabs.map((entry) => ({
      ...entry,
      prefab: normalizePrefabEditable(entry.prefab),
    }));
  } catch {
    return null;
  }
}

/** Load prefab library for runtime — tries shipped `data/prefab/` then dev editor fallback. */
export async function loadRuntimePrefabLibrary(): Promise<PrefabLibraryEntry[]> {
  const runtime = await fetchPrefabLibrary(RuntimePaths.prefabLibrary);
  if (runtime?.length) return runtime;

  const dev = await fetchPrefabLibrary(DevConfigPaths.prefabManager.library);
  return dev ?? [];
}
