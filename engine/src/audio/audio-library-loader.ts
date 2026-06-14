import type { AudioLibraryDef, AudioManifest, SfxRegistry } from './audio-types';
import type { ClipPlayer } from './clip-player';
import { resolveRegistryClip } from './sfx-registry';

function resolveClipFiles(
  def: { files?: string[]; registry?: string },
  libraryBasePath: string,
  registry: SfxRegistry | null
): { basePath: string; files: string[] } | null {
  if (def.registry) {
    const resolved = resolveRegistryClip(registry, def.registry);
    if (resolved) return resolved;
    console.warn(`[Audio] missing registry group: ${def.registry}`);
    return null;
  }
  if (def.files?.length) {
    return { basePath: libraryBasePath, files: def.files };
  }
  return null;
}

export async function loadAudioLibraries(
  manifest: AudioManifest,
  clips: ClipPlayer,
  configBaseUrl: string,
  assetsBaseUrl: string,
  registry: SfxRegistry | null,
): Promise<Map<string, AudioLibraryDef>> {
  const loaded = new Map<string, AudioLibraryDef>();
  if (!manifest.libraries) return loaded;

  for (const [libraryKey, relativePath] of Object.entries(manifest.libraries)) {
    try {
      const url = `${configBaseUrl}/${relativePath}`.replace(/\/+/g, '/').replace(':/', '://');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const library = (await res.json()) as AudioLibraryDef;
      library.id = library.id || libraryKey;
      loaded.set(library.id, library);

      const registerClip = (clipKey: string, clipDef: typeof library.clips[string]): void => {
        const resolved = resolveClipFiles(clipDef, library.basePath, registry);
        if (!resolved) return;
        clips.registerFromLibrary(
          clipKey,
          { ...clipDef, files: resolved.files },
          resolved.basePath,
          assetsBaseUrl,
          library.category,
        );
      };

      for (const [clipKey, clipDef] of Object.entries(library.clips)) {
        registerClip(clipKey, clipDef);
      }

      if (library.aliases) {
        for (const [alias, clipKey] of Object.entries(library.aliases)) {
          const def = library.clips[clipKey];
          if (def) registerClip(alias, def);
        }
      }
    } catch (err) {
      console.warn(`[Audio] library load failed: ${libraryKey}`, err);
    }
  }

  return loaded;
}
