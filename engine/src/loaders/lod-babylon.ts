import { Mesh, type AbstractMesh } from '@babylonjs/core';
import { applyLodVisibility } from './lod-runtime';
import { mapMeshesByLookupKey } from './scene-graph-utils';
import { defaultScreenThresholds, defaultDistanceThresholds } from './lod-config';

function isLodCapableMesh(mesh: AbstractMesh): mesh is Mesh {
  return mesh instanceof Mesh && !mesh.isAnInstance && !mesh.isDisposed();
}

function clearMeshLodLevels(mesh: Mesh): void {
  for (const level of [...mesh.getLODLevels()]) {
    mesh.removeLODLevel(level.mesh ?? null);
  }
}

export function resolveThresholdsForLevelCount(
  plannedThresholds: readonly number[],
  levelCount: number,
): number[] {
  if (levelCount <= 1) return [];
  const needed = levelCount - 1;
  if (plannedThresholds.length >= needed) {
    return plannedThresholds.slice(0, needed);
  }
  return defaultScreenThresholds(levelCount);
}

export function resolveDistanceThresholdsForLevelCount(
  plannedThresholds: readonly number[],
  levelCount: number,
): number[] {
  if (levelCount <= 1) return [];
  const needed = levelCount - 1;
  if (plannedThresholds.length >= needed) {
    return plannedThresholds.slice(0, needed);
  }
  return defaultDistanceThresholds(levelCount);
}

/** Initial LOD group state — runtime switching uses Unity-style height % via `updateLodByScreenCoverage`. */
export function prepareLodMeshGroups(
  lodGroups: readonly (readonly AbstractMesh[])[],
): void {
  if (lodGroups.length === 0) return;

  for (const mesh of lodGroups[0]) {
    if (!isLodCapableMesh(mesh)) continue;
    clearMeshLodLevels(mesh);
    mesh.useLODScreenCoverage = false;
  }

  applyLodVisibility(lodGroups, 0);
}

/** @deprecated Use `prepareLodMeshGroups` — thresholds are applied at runtime, not via Babylon LOD. */
export function applyBabylonScreenCoverageLod(
  lodGroups: readonly (readonly AbstractMesh[])[],
  _screenThresholdsPercent: readonly number[],
  _cullScreenPercent: number,
): void {
  prepareLodMeshGroups(lodGroups);
}

/** @deprecated Use `prepareLodMeshGroups` — cull threshold is applied at runtime. */
export function applyBabylonCullOnly(
  meshes: readonly AbstractMesh[],
  _cullScreenPercent: number,
): void {
  prepareLodMeshGroups([meshes]);
}

export {
  mapMeshesByLookupKey as mapMeshesByName,
  isLodCapableMesh,
  clearMeshLodLevels,
};
