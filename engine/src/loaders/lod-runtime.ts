import type { AbstractMesh, TransformNode } from '@babylonjs/core';
import { computeScreenCoveragePercent } from '../render/screen-coverage';
import type { Scene } from '@babylonjs/core';

export interface LodRuntimeState {
  root: TransformNode;
  lodMeshes: AbstractMesh[][];
  /** All mesh groups flattened — used for screen bounds when groups are disabled. */
  boundsMeshes: AbstractMesh[];
  screenThresholds: number[];
  cullScreenPercent: number;
}

export function createLodRuntimeState(
  root: TransformNode,
  lodMeshes: AbstractMesh[][],
  screenThresholds: number[],
  cullScreenPercent: number
): LodRuntimeState {
  return {
    root,
    lodMeshes,
    boundsMeshes: lodMeshes.flat(),
    screenThresholds,
    cullScreenPercent,
  };
}

/** Pick active LOD from screen coverage % (Unity-style transition heights). */
export function updateLodByScreenCoverage(
  scene: Scene,
  state: LodRuntimeState
): void {
  const { lodMeshes, screenThresholds, cullScreenPercent, root, boundsMeshes } = state;
  if (lodMeshes.length === 0) return;
  if (boundsMeshes.length === 0) return;

  const screenPct = computeScreenCoveragePercent(scene, root, boundsMeshes);

  if (screenPct < cullScreenPercent) {
    for (const group of lodMeshes) {
      for (const mesh of group) mesh.setEnabled(false);
    }
    return;
  }

  let active = lodMeshes.length - 1;
  for (let i = 0; i < screenThresholds.length; i++) {
    if (screenPct >= screenThresholds[i]) {
      active = i;
      break;
    }
  }

  lodMeshes.forEach((group, idx) => {
    const enabled = idx === active;
    for (const mesh of group) mesh.setEnabled(enabled);
  });
}
