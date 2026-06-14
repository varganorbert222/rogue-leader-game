import type { SfxRegistry } from './audio-types';

export async function loadSfxRegistry(
  configBaseUrl: string,
): Promise<SfxRegistry | null> {
  try {
    const url = `${configBaseUrl}/sfx/registry.json`
      .replace(/\/+/g, '/')
      .replace(':/', '://');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as SfxRegistry;
  } catch (err) {
    console.warn('[Audio] sfx registry load failed — clip registry refs will no-op', err);
    return null;
  }
}

export function resolveRegistryClip(
  registry: SfxRegistry | null,
  registryKey: string
): { basePath: string; files: string[] } | null {
  if (!registry) return null;
  const group = registry.groups[registryKey];
  if (!group?.files?.length) return null;
  return { basePath: group.basePath, files: group.files };
}
