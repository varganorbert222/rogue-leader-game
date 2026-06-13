import type { AbstractMesh, Scene, TransformNode } from '@babylonjs/core';

export interface LodRuntimeState {
  root: TransformNode;
  /** LOD0 meshes that own Babylon `addLODLevel` chains. */
  boundsMeshes: AbstractMesh[];
  screenThresholds: number[];
  cullScreenPercent: number;
}

export function createLodRuntimeState(
  root: TransformNode,
  boundsMeshes: AbstractMesh[],
  screenThresholds: number[],
  cullScreenPercent: number,
): LodRuntimeState {
  return {
    root,
    boundsMeshes: [...boundsMeshes],
    screenThresholds,
    cullScreenPercent,
  };
}

/**
 * No-op — Babylon switches LOD each frame when `useLODScreenCoverage` is set.
 * Kept for call-site compatibility.
 */
export function updateLodByScreenCoverage(
  _scene: Scene,
  _state: LodRuntimeState,
): void {}
