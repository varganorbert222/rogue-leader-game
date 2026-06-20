import { DevConfigPaths } from '../dev-config-paths';
import { defaultPrefabEditable, newBlankPrefabLibraryEntry } from './defaults';
import { normalizePrefabEditable } from './refs';
import { serializePrefabLibraryEntry } from './tree';
import type { PrefabLibraryDocument, PrefabLibraryEntry } from './types';

const BUILTIN_LIBRARY: PrefabLibraryEntry[] = [
  {
    id: 'asteroid_with_smoke',
    label: 'Asteroid + smoke',
    prefab: normalizePrefabEditable({
      id: 'prefab_asteroid_smoke',
      name: 'Asteroid + smoke',
      tree: [
        {
          id: 'mdl_asteroid',
          name: 'Asteroid',
          kind: 'model',
          children: [],
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          slot: {
            id: 'mdl_asteroid',
            name: 'Asteroid',
            modelRef: { modelId: 'asteroid', variantId: 'asteroid_01' },
          },
        },
        {
          id: 'ps_smoke',
          name: 'Smoke',
          kind: 'particleSystem',
          children: [],
          transform: {
            position: { x: 0, y: 0.5, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          slot: {
            id: 'ps_smoke',
            name: 'Smoke',
            particleRef: { presetId: 'debris_smoke', systemId: 'ps_debris_smoke' },
          },
        },
      ],
    }),
  },
];

export async function loadPrefabLibrary(): Promise<PrefabLibraryEntry[]> {
  try {
    const res = await fetch(DevConfigPaths.prefabManager.library);
    if (!res.ok) return getBuiltinPrefabLibrary();
    const json = (await res.json()) as PrefabLibraryDocument;
    if (!json.prefabs?.length) return getBuiltinPrefabLibrary();
    return json.prefabs.map((entry) => ({
      ...entry,
      prefab: normalizePrefabEditable(entry.prefab),
    }));
  } catch {
    return getBuiltinPrefabLibrary();
  }
}

export function getBuiltinPrefabLibrary(): PrefabLibraryEntry[] {
  return BUILTIN_LIBRARY.map((entry) => ({
    ...entry,
    prefab: normalizePrefabEditable(entry.prefab),
  }));
}

export { newBlankPrefabLibraryEntry, defaultPrefabEditable, serializePrefabLibraryEntry };

export function serializePrefabLibraryDocument(
  prefabs: readonly PrefabLibraryEntry[],
): PrefabLibraryDocument {
  return {
    prefabs: prefabs.map(serializePrefabLibraryEntry),
  };
}
