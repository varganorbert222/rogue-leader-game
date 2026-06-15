import {
  AbstractMesh,
  Mesh,
  SceneLoader,
  TransformNode,
  type Scene,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { LoadedEntity } from './gltf-ship-loader';
import type { ShipManifestEntry } from './asset-manifest';
import { hasShipCockpit, resolveCockpitModelPath } from './cockpit-config';
import { invalidateLodRuntime } from './lod-runtime';
import { findVisualRoot } from './clone-entity-utils';
import { collectDescendantMeshes } from './scene-graph-utils';
import { filterVisualMeshes } from './collider-mesh-detector';
import { attachGltfImportToParent } from './gltf-import-utils';
import { findVisualBankPivot } from './visual-pivot';
import { markSceneNodeGenerated } from './scene-node-origin';

export interface CockpitAttachment {
  root: TransformNode;
  meshes: AbstractMesh[];
}

const COCKPIT_ROOT_SUFFIX = '_cockpit';

export function setExteriorShipVisible(loaded: LoadedEntity, visible: boolean): void {
  for (const mesh of loaded.meshes) {
    mesh.isVisible = visible;
    if (!visible) mesh.setEnabled(false);
  }
  for (const group of loaded.lodMeshes) {
    for (const mesh of group) {
      mesh.isVisible = visible;
      if (!visible) mesh.setEnabled(false);
    }
  }
  if (visible) {
    invalidateLodRuntime(loaded.lodRuntime);
  }
}

export function setCockpitVisible(cockpit: CockpitAttachment | undefined, visible: boolean): void {
  if (!cockpit) return;
  cockpit.root.setEnabled(visible);
  for (const mesh of cockpit.meshes) {
    mesh.isVisible = visible;
    mesh.setEnabled(visible);
  }
}

export function applyCockpitViewMode(
  loaded: LoadedEntity,
  cockpit: CockpitAttachment | undefined,
  inCockpit: boolean,
): void {
  setExteriorShipVisible(loaded, !inCockpit);
  setCockpitVisible(cockpit, inCockpit);
}

export function disposeCockpitAttachment(cockpit: CockpitAttachment | undefined): void {
  if (!cockpit || cockpit.root.isDisposed()) return;
  cockpit.root.dispose(false, true);
}

/** Remove any dynamically attached cockpit interior from a ship hierarchy. */
export function stripCockpitFromRoot(root: TransformNode): void {
  const attachment = findCockpitAttachment(root);
  if (attachment) {
    disposeCockpitAttachment(attachment);
  }
}

export function stripCockpitFromLoadedEntity(loaded: LoadedEntity): void {
  stripCockpitFromRoot(loaded.root);
}

export async function loadCockpitForShip(
  scene: Scene,
  baseUrl: string,
  loaded: LoadedEntity,
  entry: ShipManifestEntry,
): Promise<CockpitAttachment | null> {
  if (!hasShipCockpit(entry)) return null;
  const modelPath = resolveCockpitModelPath(entry);
  if (!modelPath) return null;

  const url = `${baseUrl}/${modelPath}`.replace(/\/+/g, '/').replace(':/', '://');
  try {
    const result = await SceneLoader.ImportMeshAsync('', url, '', scene);
    const cockpitRoot = new TransformNode(`${loaded.root.name}${COCKPIT_ROOT_SUFFIX}`, scene);
    markSceneNodeGenerated(cockpitRoot);
    cockpitRoot.parent = findVisualBankPivot(loaded.visualRoot) ?? loaded.visualRoot;
    attachGltfImportToParent(result, cockpitRoot);

    const allMeshes = collectDescendantMeshes(cockpitRoot);
    const meshes = filterVisualMeshes(allMeshes, []);
    setCockpitVisible({ root: cockpitRoot, meshes }, false);

    return { root: cockpitRoot, meshes };
  } catch {
    return null;
  }
}

export function findCockpitAttachment(root: TransformNode): CockpitAttachment | null {
  const visualRoot = findVisualRoot(root);
  const cockpitRoot = visualRoot
    .getChildTransformNodes(true)
    .find((node) => node.name.endsWith(COCKPIT_ROOT_SUFFIX));
  if (!cockpitRoot) return null;
  const meshes = collectDescendantMeshes(cockpitRoot).filter(
    (node): node is Mesh => node instanceof Mesh,
  );
  return { root: cockpitRoot, meshes };
}
