import { DevConfigPaths } from './dev-config-paths';
import type { CockpitEditableConfig } from './cockpit-editor-types';

export async function loadCockpitEditorOverride(shipId: string): Promise<CockpitEditableConfig | null> {
  try {
    const res = await fetch(DevConfigPaths.cockpitEditor.shipConfig(shipId));
    if (!res.ok) return null;
    return (await res.json()) as CockpitEditableConfig;
  } catch {
    return null;
  }
}
