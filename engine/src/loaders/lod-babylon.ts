import { Mesh, type AbstractMesh } from '@babylonjs/core';
import { normalizeAnchorNodeName } from './ship-anchor-detector';
import { defaultScreenThresholds } from './lod-config';

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

/** Wire Babylon's built-in screen-coverage LOD + cull on LOD0 meshes. */
export function applyBabylonScreenCoverageLod(
  lodGroups: readonly (readonly AbstractMesh[])[],
  screenThresholdsPercent: readonly number[],
  cullScreenPercent: number,
): void {
  if (lodGroups.length === 0) return;

  const lod0Group = lodGroups[0];
  if (lod0Group.length === 0) return;

  const thresholds = resolveThresholdsForLevelCount(
    screenThresholdsPercent,
    lodGroups.length,
  );
  const cullCoverage = Math.max(0, cullScreenPercent) / 100;

  const lowerMaps: Map<AbstractMesh, AbstractMesh>[] = [];
  for (let level = 1; level < lodGroups.length; level++) {
    lowerMaps.push(mapMeshesByName(lod0Group, lodGroups[level]));
  }

  for (const lod0Mesh of lod0Group) {
    if (!isLodCapableMesh(lod0Mesh)) continue;

    clearMeshLodLevels(lod0Mesh);
    lod0Mesh.useLODScreenCoverage = true;
    lod0Mesh.setEnabled(true);
    lod0Mesh.isVisible = true;

    for (let level = 0; level < lowerMaps.length; level++) {
      const lowerMesh = lowerMaps[level].get(lod0Mesh);
      const thresholdPct = thresholds[level];
      if (!lowerMesh || thresholdPct == null) continue;
      if (!isLodCapableMesh(lowerMesh)) continue;

      lowerMesh.setEnabled(false);
      lowerMesh.isVisible = false;
      lod0Mesh.addLODLevel(thresholdPct / 100, lowerMesh);
    }

    lod0Mesh.addLODLevel(cullCoverage, null);
  }

  for (let level = 1; level < lodGroups.length; level++) {
    for (const mesh of lodGroups[level]) {
      if (mesh.isDisposed()) continue;
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }
  }
}

/** Cull-only when a model has a single LOD group. */
export function applyBabylonCullOnly(
  meshes: readonly AbstractMesh[],
  cullScreenPercent: number,
): void {
  const cullCoverage = Math.max(0, cullScreenPercent) / 100;
  for (const mesh of meshes) {
    if (!isLodCapableMesh(mesh)) continue;
    clearMeshLodLevels(mesh);
    mesh.useLODScreenCoverage = true;
    mesh.addLODLevel(cullCoverage, null);
  }
}
