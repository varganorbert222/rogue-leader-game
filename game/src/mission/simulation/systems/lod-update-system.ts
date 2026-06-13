import type { Scene } from '@babylonjs/core';
import { updateLod, type LodRuntimeState } from '@rogue-leader/engine';

export function updateMissionLodStates(
  scene: Scene,
  lodStates: readonly LodRuntimeState[],
): void {
  scene.updateTransformMatrix(true);

  for (const state of lodStates) {
    updateLod(scene, state);
  }
}
