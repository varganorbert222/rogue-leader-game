import type { LodConfig, LodManifestValue, LodMetric } from '../loaders/lod-config';
import {
  DEFAULT_CULL_DISTANCE,
  DEFAULT_CULL_SCREEN_PERCENT,
} from '../loaders/lod-config';
export {
  predictActiveLodIndex,
  predictActiveLodIndexByDistance,
  predictActiveLodIndexByScreen,
  predictActiveLodIndexForMetric,
} from '../loaders/lod-runtime';

export type LodEditorModelKind = 'ship' | 'prop';

export interface LodEditorModelEntry {
  id: string;
  kind: LodEditorModelKind;
  label: string;
  scale: number | [number, number] | [number, number, number];
  lod: LodManifestValue | undefined;
}

export interface LodPreviewLiveState {
  metric: LodMetric;
  coveragePercent: number;
  cameraDistanceMeters: number;
  activeLodIndex: number;
  culled: boolean;
  cameraRadius: number;
}

export interface LodPreviewLevelInfo {
  index: number;
  label: string;
  vertexCount: number;
  meshCount: number;
}

export interface LodPreviewSnapshot {
  modelId: string;
  levelCount: number;
  levels: LodPreviewLevelInfo[];
  metric: LodMetric;
  screenThresholds: number[];
  cullScreenPercent: number;
  distanceThresholds: number[];
  cullDistance: number;
}

/** Normalize manifest `lod` values into an editable config object. */
export function lodManifestToEditableConfig(
  lod: LodManifestValue | undefined,
): LodConfig {
  if (!lod) {
    return {
      mode: 'none',
      metric: 'screen',
      discoverSiblingLods: false,
      enableAutoSimplify: false,
      cullScreenPercent: DEFAULT_CULL_SCREEN_PERCENT,
      cullDistance: DEFAULT_CULL_DISTANCE,
    };
  }

  if (Array.isArray(lod)) {
    return {
      mode: 'manual',
      metric: 'screen',
      paths: [...lod],
      discoverSiblingLods: false,
      enableAutoSimplify: false,
      cullScreenPercent: DEFAULT_CULL_SCREEN_PERCENT,
      cullDistance: DEFAULT_CULL_DISTANCE,
    };
  }

  return {
    ...lod,
    metric: lod.metric ?? 'screen',
    discoverSiblingLods: lod.discoverSiblingLods ?? false,
    enableAutoSimplify: lod.enableAutoSimplify ?? lod.mode === 'auto',
    cullScreenPercent: lod.cullScreenPercent ?? DEFAULT_CULL_SCREEN_PERCENT,
    cullDistance: lod.cullDistance ?? DEFAULT_CULL_DISTANCE,
  };
}

export function editableConfigToManifestValue(config: LodConfig): LodManifestValue {
  const paths = config.paths?.filter(Boolean);
  const hasOnlyPaths =
    !config.levels?.length &&
    paths?.length &&
    config.mode === 'manual' &&
    !config.enableAutoSimplify &&
    config.discoverSiblingLods !== false &&
    (config.metric ?? 'screen') === 'screen';

  if (hasOnlyPaths) {
    return [...paths];
  }

  const copy: LodConfig = { ...config };
  if (copy.paths?.length === 0) delete copy.paths;
  if (copy.metric === 'screen') delete copy.metric;
  return copy;
}

export function resolvePreviewScale(
  scale: number | [number, number] | [number, number, number],
): number | [number, number, number] {
  if (Array.isArray(scale)) {
    if (scale.length === 2) return scale[1];
    return scale as [number, number, number];
  }
  return scale;
}
