import { Mesh, type AbstractMesh } from '@babylonjs/core';
import { normalizeAnchorNodeName } from './ship-anchor-detector';
import { defaultScreenThresholds, defaultDistanceThresholds } from './lod-config';

function meshLookupKey(name: string): string {
  return normalizeAnchorNodeName(name).toLowerCase();
}

function isLodCapableMesh(mesh: AbstractMesh): mesh is Mesh {
  return mesh instanceof Mesh && !mesh.isAnInstance && !mesh.isDisposed();
}

function clearMeshLodLevels(mesh: Mesh): void {
  for (const level of [...mesh.getLODLevels()]) {
    mesh.removeLODLevel(level.mesh ?? null);
  }
}

function mapMeshesByName(
  lod0Meshes: readonly AbstractMesh[],
  otherMeshes: readonly AbstractMesh[],
): Map<AbstractMesh, AbstractMesh> {
  const byKey = new Map<string, AbstractMesh>();
  for (const mesh of otherMeshes) {
    byKey.set(meshLookupKey(mesh.name), mesh);
  }

  const pairs = new Map<AbstractMesh, AbstractMesh>();
  for (const lod0 of lod0Meshes) {
    const match = byKey.get(meshLookupKey(lod0.name));
    if (match) pairs.set(lod0, match);
  }
  return pairs;
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

  for (let level = 0; level < lodGroups.length; level++) {
    const show = level === 0;
    for (const mesh of lodGroups[level]) {
      if (mesh.isDisposed()) continue;
      mesh.setEnabled(show);
      mesh.isVisible = show;
    }
  }
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

export { mapMeshesByName, isLodCapableMesh, clearMeshLodLevels };
