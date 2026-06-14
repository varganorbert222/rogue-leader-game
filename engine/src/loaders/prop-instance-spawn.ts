import {
  Mesh,
  TransformNode,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import type { PropManifestEntry } from './asset-manifest';
import type { LoadedEntity } from './gltf-ship-loader';
import {
  applyPropColliderPolicy,
  configureColliderMesh,
  filterVisualLodMeshes,
  filterVisualMeshes,
  isVisualColliderMesh,
} from './collider-mesh-detector';
import {
  collectDescendantMeshes,
  findVisualRoot,
} from './clone-entity-utils';
import { createLodRuntimeState } from './lod-runtime';
import { ensureMeshWorldMatrix } from '../render/mesh-world-utils';
import { DEFAULT_CULL_DISTANCE, DEFAULT_CULL_SCREEN_PERCENT } from './lod-config';
import { prepareLodMeshGroups } from './lod-babylon';

function findMatchingTransformNode(
  templateRoot: TransformNode,
  cloneRoot: TransformNode,
  templateNode: TransformNode,
): TransformNode {
  if (templateNode === templateRoot) return cloneRoot;

  const path: string[] = [];
  let current: TransformNode | null = templateNode;
  while (current && current !== templateRoot) {
    path.unshift(current.name);
    current = current.parent instanceof TransformNode ? current.parent : null;
  }

  let node: TransformNode = cloneRoot;
  for (const name of path) {
    const child = node.getChildren().find((entry) => entry.name === name);
    if (!child || !(child instanceof TransformNode)) break;
    node = child;
  }

  return node;
}

function copyTransformState(source: TransformNode, target: TransformNode): void {
  target.position.copyFrom(source.position);
  target.scaling.copyFrom(source.scaling);
  if (source.rotationQuaternion) {
    target.rotationQuaternion = source.rotationQuaternion.clone();
  } else {
    target.rotationQuaternion = null;
    target.rotation.copyFrom(source.rotation);
  }
}

/** Clone transform nodes only — glTF meshes stay on the hidden template for instancing. */
function cloneTransformSkeletonOnly(
  source: TransformNode,
  parent: TransformNode | null,
  name: string,
  scene: Scene,
): TransformNode {
  const node = new TransformNode(name, scene);
  node.parent = parent;
  copyTransformState(source, node);

  for (const child of source.getChildren()) {
    if (child instanceof Mesh) continue;
    if (child instanceof TransformNode) {
      cloneTransformSkeletonOnly(child, node, child.name, scene);
    }
  }

  return node;
}

function canCreateMeshInstance(mesh: Mesh): boolean {
  if (mesh.isDisposed() || mesh.isAnInstance) return false;
  return mesh.geometry != null && mesh.getTotalVertices() > 0;
}

function resolveInstanceParent(
  templateRoot: TransformNode,
  cloneRoot: TransformNode,
  sourceMesh: AbstractMesh,
): TransformNode {
  let node: TransformNode | null =
    sourceMesh.parent instanceof TransformNode ? sourceMesh.parent : null;

  while (node && node !== templateRoot) {
    if (!(node instanceof Mesh)) {
      const matched = findMatchingTransformNode(templateRoot, cloneRoot, node);
      if (matched !== cloneRoot) return matched;
    }
    node = node.parent instanceof TransformNode ? node.parent : null;
  }

  return cloneRoot;
}

function collectInstanceSourceMeshes(template: LoadedEntity): Mesh[] {
  const sources = new Set<Mesh>();
  const lod0 = template.lodMeshes[0] ?? template.meshes;

  for (const mesh of lod0) {
    if (mesh instanceof Mesh && canCreateMeshInstance(mesh)) sources.add(mesh);
  }

  for (const mesh of template.colliderMeshes) {
    if (template.meshes.includes(mesh)) continue;
    if (mesh instanceof Mesh && canCreateMeshInstance(mesh)) sources.add(mesh);
  }

  if (sources.size === 0) {
    for (const mesh of collectDescendantMeshes(template.root)) {
      if (mesh instanceof Mesh && canCreateMeshInstance(mesh)) sources.add(mesh);
    }
  }

  return [...sources];
}

function remapMeshesBySource(
  templateMeshes: readonly AbstractMesh[],
  sourceToInstance: ReadonlyMap<AbstractMesh, AbstractMesh>,
): AbstractMesh[] {
  const remapped: AbstractMesh[] = [];
  for (const mesh of templateMeshes) {
    const instance = sourceToInstance.get(mesh);
    if (instance) remapped.push(instance);
  }
  return remapped;
}

/**
 * Hide template source meshes while keeping them alive for `createInstance()`.
 * Call once per variant before spawning instances.
 */
export function preparePropInstanceTemplate(template: LoadedEntity): void {
  template.root.setEnabled(true);

  for (const mesh of collectDescendantMeshes(template.root)) {
    if (!(mesh instanceof Mesh)) continue;
    mesh.setEnabled(true);
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
  }
}

/**
 * Spawn a prop from a loaded template using Babylon mesh instances (shared geometry/material).
 * Keeps a cloned transform hierarchy so per-instance offsets and tumbling stay correct.
 */
export function spawnPropInstancesFromTemplate(
  template: LoadedEntity,
  instanceId: string,
  entry: PropManifestEntry,
  options?: { groupParent?: TransformNode },
): LoadedEntity {
  const wasTemplateEnabled = template.root.isEnabled();
  if (!wasTemplateEnabled) {
    template.root.setEnabled(true);
  }

  const scene = template.root.getScene();
  if (!scene) {
    throw new Error(`Cannot instance prop "${instanceId}": template root has no scene`);
  }

  const root = cloneTransformSkeletonOnly(
    template.root,
    options?.groupParent ?? null,
    `${instanceId}_root`,
    scene,
  );
  const visualRoot = findVisualRoot(root);

  const sourceMeshes = collectInstanceSourceMeshes(template);
  const sourceToInstance = new Map<AbstractMesh, AbstractMesh>();

  for (const sourceMesh of sourceMeshes) {
    if (!canCreateMeshInstance(sourceMesh)) continue;

    const parent = resolveInstanceParent(template.root, root, sourceMesh);

    const instance = sourceMesh.createInstance(`${instanceId}_${sourceMesh.name}`);
    if (sourceMesh.material) {
      instance.material = sourceMesh.material;
    }
    instance.parent = parent;
    instance.position.copyFrom(sourceMesh.position);
    instance.scaling.copyFrom(sourceMesh.scaling);
    if (sourceMesh.rotationQuaternion) {
      instance.rotationQuaternion = sourceMesh.rotationQuaternion.clone();
    } else {
      instance.rotationQuaternion = null;
      instance.rotation.copyFrom(sourceMesh.rotation);
    }
    instance.setEnabled(true);
    instance.isVisible = true;
    instance.isPickable = false;
    sourceToInstance.set(sourceMesh, instance);
  }

  const instanceMeshes = remapMeshesBySource(template.meshes, sourceToInstance);
  const lodMeshes = template.lodMeshes.map((group) =>
    remapMeshesBySource(group, sourceToInstance),
  );
  const fallbackMeshes =
    instanceMeshes.length > 0
      ? instanceMeshes
      : [...sourceToInstance.values()];

  let meshes = fallbackMeshes;
  let colliderMeshes: AbstractMesh[] = [];

  if (entry.colliderSource === 'named') {
    const namedSources = template.colliderMeshes.filter(
      (mesh) => !template.meshes.includes(mesh),
    );
    colliderMeshes = remapMeshesBySource(namedSources, sourceToInstance);
    meshes = filterVisualMeshes(fallbackMeshes, colliderMeshes);
  }

  const visualLodMeshes =
    entry.colliderSource === 'named'
      ? filterVisualLodMeshes(lodMeshes, colliderMeshes)
      : lodMeshes;

  prepareLodMeshGroups(visualLodMeshes);

  const lodRuntime = createLodRuntimeState(
    root,
    visualLodMeshes,
    visualLodMeshes[0] ?? [],
    {
      metric: template.lodRuntime.metric,
      screenThresholds: template.lodRuntime.screenThresholds,
      cullScreenPercent:
        template.lodRuntime.cullScreenPercent ?? DEFAULT_CULL_SCREEN_PERCENT,
      distanceThresholds: template.lodRuntime.distanceThresholds,
      cullDistance: template.lodRuntime.cullDistance ?? DEFAULT_CULL_DISTANCE,
    },
  );

  const loaded: LoadedEntity = {
    root,
    visualRoot,
    meshes,
    lodMeshes: visualLodMeshes,
    colliderRadius: template.colliderRadius,
    colliderMeshes,
    firePoints: { fires: [], engines: [] },
    anchors: { engines: [], weapons: [] },
    visual: template.visual,
    lodRuntime,
    isPlaceholder: template.isPlaceholder,
    animationGroups: [],
  };

  applyPropColliderPolicy(loaded, entry);

  for (const mesh of loaded.colliderMeshes) {
    if (isVisualColliderMesh(mesh)) {
      ensureMeshWorldMatrix(mesh);
      continue;
    }
    if (mesh instanceof Mesh) configureColliderMesh(mesh);
  }

  // Source meshes must stay enabled (but invisible) for further instances and mesh hits.
  preparePropInstanceTemplate(template);

  return loaded;
}
