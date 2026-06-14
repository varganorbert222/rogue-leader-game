import type { LodManifestValue } from './lod-config';
import type { ShipManifestEntry } from './asset-manifest';
import { degToRad } from '../math';

/** Cockpit camera shift from flight stick input (deterministic, no physics). */
export interface CockpitInputResponseConfig {
  /** Full-stick ship-local offset [right←yaw, up←pitch, back←throttle] in meters. */
  maxInputOffset: [number, number, number];
  /** Spring smooth time for stick-driven shift (seconds). */
  smoothTime: number;
}

export interface CockpitConfig {
  localOffset: [number, number, number];
  localRotationDeg?: [number, number, number];
  lookLimits?: { yaw: number; pitch: number };
  fov?: number;
  inputResponse?: Partial<CockpitInputResponseConfig> & {
    /** @deprecated Legacy rate (1/s) — converted to {@link CockpitInputResponseConfig.smoothTime}. */
    smoothing?: number;
  };
  /** @deprecated Legacy manifest key — migrated to {@link inputResponse}. */
  gforce?: Record<string, unknown>;
  modelPath?: string;
}

export interface ResolvedCockpitConfig {
  localOffset: [number, number, number];
  localRotationDeg: [number, number, number];
  lookLimits: { yaw: number; pitch: number };
  fov: number;
  inputResponse: CockpitInputResponseConfig;
  modelPath: string | null;
}

export const DEFAULT_COCKPIT_INPUT_RESPONSE: CockpitInputResponseConfig = {
  maxInputOffset: [0.07, 0.05, 0.05],
  smoothTime: 0.12,
};

function legacyRateToSmoothTime(rate: number): number {
  return 1 / Math.max(rate, 0.01);
}

function resolveSmoothTime(
  inputResponse?: CockpitConfig['inputResponse'],
  legacySmoothing?: number,
): number {
  if (typeof inputResponse?.smoothTime === 'number') {
    return inputResponse.smoothTime;
  }
  if (typeof inputResponse?.smoothing === 'number') {
    return legacyRateToSmoothTime(inputResponse.smoothing);
  }
  if (typeof legacySmoothing === 'number') {
    return legacyRateToSmoothTime(legacySmoothing);
  }
  return DEFAULT_COCKPIT_INPUT_RESPONSE.smoothTime;
}

export const DEFAULT_COCKPIT_FOV_DEG = 60;

export const DEFAULT_COCKPIT_CONFIG: ResolvedCockpitConfig = {
  localOffset: [0, 0.15, 0.35],
  localRotationDeg: [0, 0, 0],
  lookLimits: { yaw: 0.8, pitch: 0.5 },
  fov: degToRad(DEFAULT_COCKPIT_FOV_DEG),
  inputResponse: DEFAULT_COCKPIT_INPUT_RESPONSE,
  modelPath: null,
};

function firstLodPath(lod: LodManifestValue | undefined): string | null {
  if (!lod) return null;
  if (Array.isArray(lod)) return lod[0] ?? null;
  if (lod.paths?.[0]) return lod.paths[0];
  const firstLevel = lod.levels?.[0];
  if (typeof firstLevel === 'string') return firstLevel;
  if (firstLevel && typeof firstLevel === 'object' && 'path' in firstLevel) {
    return firstLevel.path;
  }
  return null;
}

export function deriveCockpitModelPath(lodPath: string): string | null {
  const derived = lodPath.replace(/([_-])LOD\d+/i, '$1cockpit');
  return derived !== lodPath ? derived : null;
}

export function hasShipCockpit(entry: ShipManifestEntry): boolean {
  return entry.cockpit != null;
}

export function resolveCockpitModelPath(entry: ShipManifestEntry): string | null {
  if (!entry.cockpit) return null;
  if (entry.cockpit.modelPath) return entry.cockpit.modelPath;
  const lodPath = firstLodPath(entry.lod);
  if (!lodPath) return null;
  return deriveCockpitModelPath(lodPath);
}

export function suggestCockpitModelPath(entry: ShipManifestEntry): string | null {
  if (entry.cockpit?.modelPath) return entry.cockpit.modelPath;
  const lodPath = firstLodPath(entry.lod);
  if (!lodPath) return null;
  return deriveCockpitModelPath(lodPath);
}

function resolveInputResponse(raw?: CockpitConfig): CockpitInputResponseConfig {
  if (raw?.inputResponse) {
    return {
      maxInputOffset: raw.inputResponse.maxInputOffset
        ? [...raw.inputResponse.maxInputOffset]
        : [...DEFAULT_COCKPIT_INPUT_RESPONSE.maxInputOffset],
      smoothTime: resolveSmoothTime(raw.inputResponse),
    };
  }

  const legacy = raw?.gforce as { maxTranslation?: number; smoothing?: number } | undefined;
  if (legacy) {
    const m = typeof legacy.maxTranslation === 'number' ? legacy.maxTranslation : 0.07;
    return {
      maxInputOffset: [m, m * 0.7, m * 0.6],
      smoothTime: resolveSmoothTime(undefined, legacy.smoothing),
    };
  }

  return {
    maxInputOffset: [...DEFAULT_COCKPIT_INPUT_RESPONSE.maxInputOffset],
    smoothTime: DEFAULT_COCKPIT_INPUT_RESPONSE.smoothTime,
  };
}

export function resolveCockpitConfig(entry: ShipManifestEntry): ResolvedCockpitConfig | null {
  const raw = entry.cockpit;
  if (!raw) return null;
  const modelPath = resolveCockpitModelPath(entry);

  return {
    localOffset: raw.localOffset ?? DEFAULT_COCKPIT_CONFIG.localOffset,
    localRotationDeg: raw.localRotationDeg ?? DEFAULT_COCKPIT_CONFIG.localRotationDeg,
    lookLimits: {
      yaw: raw.lookLimits?.yaw ?? DEFAULT_COCKPIT_CONFIG.lookLimits.yaw,
      pitch: raw.lookLimits?.pitch ?? DEFAULT_COCKPIT_CONFIG.lookLimits.pitch,
    },
    fov: raw.fov ?? DEFAULT_COCKPIT_CONFIG.fov,
    inputResponse: resolveInputResponse(raw),
    modelPath,
  };
}
