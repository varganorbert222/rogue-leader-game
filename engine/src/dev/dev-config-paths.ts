import { RuntimePaths } from '../runtime-paths';

export const DevConfigTools = {
  particleEditor: 'particle-editor',
  lodEditor: 'lod-editor',
  cockpitEditor: 'cockpit-editor',
  prefabManager: 'prefab-manager',
} as const;

export type DevConfigToolId = (typeof DevConfigTools)[keyof typeof DevConfigTools];

const DEV_CONFIG_BASE = `${RuntimePaths.dataBase}/dev`;

export const DevConfigPaths = {
  root: DEV_CONFIG_BASE,
  particleEditor: {
    presets: `${DEV_CONFIG_BASE}/particle-editor/presets.json`,
    textures: `${DEV_CONFIG_BASE}/particle-editor/textures.json`,
  },
  lodEditor: {
    shipConfig: (modelId: string) => `${DEV_CONFIG_BASE}/lod-editor/ships/${modelId}.json`,
  },
  cockpitEditor: {
    shipConfig: (shipId: string) => `${DEV_CONFIG_BASE}/cockpit-editor/ships/${shipId}.json`,
  },
  prefabManager: {
    library: `${DEV_CONFIG_BASE}/prefab-manager/library.json`,
  },
} as const;

export function devConfigDiskPath(tool: DevConfigToolId, filename: string): string {
  return `data/dev/${tool}/${filename}`;
}
