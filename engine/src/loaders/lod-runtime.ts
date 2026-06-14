import type { AbstractMesh, Scene, TransformNode } from '@babylonjs/core';
import type { LodMetric } from './lod-config';
import { computeCameraDistanceMeters } from '../render/lod-distance';
import { computeScreenCoveragePercent } from '../render/screen-coverage';

export interface LodRuntimeState {
  root: TransformNode;
  /** All visual LOD groups (LOD0 first). */
  lodMeshes: AbstractMesh[][];
  /** LOD0 meshes used for bounds / metric sampling. */
  boundsMeshes: AbstractMesh[];
  metric: LodMetric;
  screenThresholds: number[];
  cullScreenPercent: number;
  distanceThresholds: number[];
  cullDistance: number;
  /** -1 when culled; otherwise active LOD group index. */
  activeLodIndex: number;
}

export function predictActiveLodIndexByScreen(
  coveragePercent: number,
  thresholds: readonly number[],
  levelCount: number,
  cullPercent: number,
): number {
  if (levelCount <= 0) return -1;
  if (coveragePercent < cullPercent) return -1;
  if (levelCount === 1) return 0;

  for (let i = 0; i < thresholds.length; i++) {
    if (coveragePercent >= thresholds[i]) return i;
  }

  return levelCount - 1;
}

export function predictActiveLodIndexByDistance(
  distanceMeters: number,
  thresholds: readonly number[],
  levelCount: number,
  cullDistance: number,
): number {
  if (levelCount <= 0) return -1;
  if (distanceMeters > cullDistance) return -1;
  if (levelCount === 1) return 0;

  for (let i = 0; i < thresholds.length; i++) {
    if (distanceMeters <= thresholds[i]) return i;
  }

  return levelCount - 1;
}

/** @deprecated Use `predictActiveLodIndexByScreen`. */
export const predictActiveLodIndex = predictActiveLodIndexByScreen;

export function predictActiveLodIndexForMetric(
  metric: LodMetric,
  sampleValue: number,
  thresholds: readonly number[],
  levelCount: number,
  cullValue: number,
): number {
  return metric === 'distance'
    ? predictActiveLodIndexByDistance(sampleValue, thresholds, levelCount, cullValue)
    : predictActiveLodIndexByScreen(sampleValue, thresholds, levelCount, cullValue);
}

export function applyLodVisibility(
  lodMeshes: readonly (readonly AbstractMesh[])[],
  activeIndex: number,
): void {
  for (let i = 0; i < lodMeshes.length; i++) {
    const show = i === activeIndex;
    for (const mesh of lodMeshes[i]) {
      if (mesh.isDisposed()) continue;
      mesh.setEnabled(show);
      mesh.isVisible = show;
    }
  }
}

export function createLodRuntimeState(
  root: TransformNode,
  lodMeshes: AbstractMesh[][],
  boundsMeshes: AbstractMesh[],
  options: {
    metric: LodMetric;
    screenThresholds: number[];
    cullScreenPercent: number;
    distanceThresholds: number[];
    cullDistance: number;
  },
): LodRuntimeState {
  return {
    root,
    lodMeshes: lodMeshes.map((group) => [...group]),
    boundsMeshes: [...boundsMeshes],
    metric: options.metric,
    screenThresholds: [...options.screenThresholds],
    cullScreenPercent: options.cullScreenPercent,
    distanceThresholds: [...options.distanceThresholds],
    cullDistance: options.cullDistance,
    activeLodIndex: lodMeshes.length > 0 ? 0 : -1,
  };
}

export function resolveActiveLodIndex(scene: Scene, state: LodRuntimeState): number {
  if (state.lodMeshes.length === 0) return -1;

  if (state.metric === 'distance') {
    const distance = computeCameraDistanceMeters(
      scene,
      state.root,
      state.boundsMeshes,
    );
    return predictActiveLodIndexByDistance(
      distance,
      state.distanceThresholds,
      state.lodMeshes.length,
      state.cullDistance,
    );
  }

  const coverage = computeScreenCoveragePercent(
    scene,
    state.root,
    state.boundsMeshes,
  );
  return predictActiveLodIndexByScreen(
    coverage,
    state.screenThresholds,
    state.lodMeshes.length,
    state.cullScreenPercent,
  );
}

export function updateLod(scene: Scene, state: LodRuntimeState): void {
  const activeIndex = resolveActiveLodIndex(scene, state);
  if (activeIndex === state.activeLodIndex) return;

  state.activeLodIndex = activeIndex;
  applyLodVisibility(state.lodMeshes, activeIndex);
}

/** Force the next {@link updateLod} call to re-apply mesh visibility (pool respawn). */
export function invalidateLodRuntime(state: LodRuntimeState): void {
  state.activeLodIndex = Number.MIN_SAFE_INTEGER;
}

/** @deprecated Use `updateLod`. */
export const updateLodByScreenCoverage = updateLod;
