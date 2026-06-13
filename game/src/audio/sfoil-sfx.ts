import type { ShipSfoilAbilityManifest, ShipSfoilSfxManifest } from '@rogue-leader/engine';

export type SfoilSfxPlayRequest =
  | { kind: 'clip'; clipId: string }
  | { kind: 'clips'; clipIds: readonly string[] }
  | { kind: 'files'; basePath: string; files: readonly string[] };

export function resolveShipSfoilSfx(
  sfx: ShipSfoilAbilityManifest['sfx']
): SfoilSfxPlayRequest | null {
  if (!sfx) return null;

  if (typeof sfx === 'string') {
    return { kind: 'clip', clipId: sfx };
  }

  if (Array.isArray(sfx)) {
    if (sfx.length === 0) return null;
    if (sfx.length === 1) return { kind: 'clip', clipId: sfx[0] };
    return { kind: 'clips', clipIds: sfx };
  }

  return resolveShipSfoilSfxFiles(sfx);
}

function resolveShipSfoilSfxFiles(config: ShipSfoilSfxManifest): SfoilSfxPlayRequest | null {
  if (!config.files.length) return null;
  return {
    kind: 'files',
    basePath: config.basePath ?? 'audio/sfx/xwing',
    files: config.files,
  };
}

export function sfoilSfxToEventPayload(
  request: SfoilSfxPlayRequest,
  position?: import('@babylonjs/core').Vector3
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (position) payload['position'] = position;

  switch (request.kind) {
    case 'clip':
      payload['sfx'] = request.clipId;
      break;
    case 'clips':
      payload['sfxClipIds'] = [...request.clipIds];
      break;
    case 'files':
      payload['sfxBasePath'] = request.basePath;
      payload['sfxFiles'] = [...request.files];
      break;
  }

  return payload;
}
