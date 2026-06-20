import '@babylonjs/loaders/glTF';
import type { Scene } from '@babylonjs/core';
import type { AssetManifest, PropManifestEntry, ShipManifestEntry } from '../../loaders/asset-manifest';
import { GltfShipLoader, type LoadedEntity } from '../../loaders/gltf-ship-loader';
import { LodShipLoader } from '../../loaders/lod-ship-loader';
import { RuntimePaths } from '../../runtime-paths';
import type { HierarchyNode } from '../hierarchy-types';
import { buildModelContentHierarchy } from '../scene-hierarchy-builder';
import type { LodEditorModelEntry } from '../lod-editor-types';
import { resolvePreviewScale } from '../lod-editor-types';
import { createModelSlot, createModelTreeNode, nextPrefabNodeId } from './defaults';
import { defaultPrefabNodeTransform } from './transform';
import { resolvePrefabModelGlbPath } from './model-ref';
import { isPrefabModelSlot } from './refs';
import { walkPrefabTree } from './tree';
import type { PrefabEditable, PrefabModelRef, PrefabModelSlot, PrefabTreeNode } from './types';

function propEntryFromGlbPath(
  glbPath: string,
  source: {
    scale: number | [number, number] | [number, number, number];
    colliderRadius: number;
    colliderSource?: PropManifestEntry['colliderSource'];
  },
): PropManifestEntry {
  const scale = source.scale;
  return {
    lod: { mode: 'none', basePath: glbPath },
    scale:
      Array.isArray(scale) && scale.length === 3
        ? (resolvePreviewScale(scale) as number | [number, number])
        : scale,
    colliderRadius: source.colliderRadius,
    colliderSource: source.colliderSource,
  };
}

function prefabSceneNodesFromHierarchy(nodes: readonly HierarchyNode[]): PrefabTreeNode[] {
  return nodes.map((node) => ({
    id: nextPrefabNodeId('scn'),
    name: node.label,
    kind: 'sceneNode' as const,
    sceneName: node.sceneName ?? node.label,
    children: prefabSceneNodesFromHierarchy(node.children),
    transform: defaultPrefabNodeTransform(),
  }));
}

export async function loadManifestModelEntity(
  scene: Scene,
  modelRef: PrefabModelRef,
  models: readonly LodEditorModelEntry[],
  manifest: AssetManifest,
  assetsBaseUrl = RuntimePaths.assetsBase,
): Promise<LoadedEntity | null> {
  const catalogEntry = models.find((entry) => entry.id === modelRef.modelId);
  if (!catalogEntry) return null;

  const lodLoader = new LodShipLoader(scene, assetsBaseUrl);
  const loader = new GltfShipLoader(scene, assetsBaseUrl, lodLoader);

  if (catalogEntry.kind === 'ship') {
    const baseShipId = catalogEntry.id.endsWith('_x')
      ? catalogEntry.id.slice(0, -2)
      : modelRef.modelId;
    const shipEntry = manifest.ships[baseShipId];
    if (!shipEntry) return null;

    if (catalogEntry.id.endsWith('_x') && catalogEntry.id !== baseShipId) {
      const glbPath = resolvePrefabModelGlbPath(modelRef, models);
      if (!glbPath) return null;
      return loader.loadProp(
        catalogEntry.id,
        propEntryFromGlbPath(glbPath, {
          scale: shipEntry.scale,
          colliderRadius: shipEntry.colliderRadius,
        }),
      );
    }

    return loader.loadShip(modelRef.modelId, shipEntry);
  }

  const propEntry = manifest.props[modelRef.modelId];
  if (!propEntry) return null;
  return loadPropEntity(loader, modelRef, propEntry, models);
}

async function loadPropEntity(
  loader: GltfShipLoader,
  modelRef: PrefabModelRef,
  entry: PropManifestEntry,
  models: readonly LodEditorModelEntry[],
): Promise<LoadedEntity | null> {
  const glbPath = resolvePrefabModelGlbPath(modelRef, models);
  if (glbPath && !entry.variants?.includes(glbPath)) {
    return loader.loadProp(
      modelRef.modelId,
      propEntryFromGlbPath(glbPath, entry),
    );
  }

  if (entry.variants?.length) {
    const templates = await loader.loadPropVariantTemplates(modelRef.modelId, entry);
    if (!templates.length) return null;

    const glbPath = resolvePrefabModelGlbPath(modelRef, models);
    if (glbPath) {
      const variantIndex = entry.variants.findIndex((path) => path === glbPath);
      if (variantIndex >= 0 && templates[variantIndex]) {
        return templates[variantIndex];
      }
    }

    const variantId = modelRef.variantId;
    if (variantId) {
      const variantIndex = entry.variants.findIndex((path) => {
        const id = path.split('/').pop()?.replace(/\.glb$/i, '') ?? path;
        return id === variantId;
      });
      if (variantIndex >= 0 && templates[variantIndex]) {
        return templates[variantIndex];
      }
    }

    return templates[0] ?? null;
  }

  return loader.loadProp(modelRef.modelId, entry);
}

/** Load a manifest model and build a prefab tree node with imported GLB hierarchy children. */
export async function createModelReferenceTree(
  scene: Scene,
  modelRef: PrefabModelRef,
  models: readonly LodEditorModelEntry[],
  manifest: AssetManifest,
  name: string,
): Promise<PrefabTreeNode> {
  const slot: PrefabModelSlot = createModelSlot(
    modelRef.modelId,
    name,
    modelRef.variantId,
  );
  const modelNode = createModelTreeNode(slot);

  const entity = await loadManifestModelEntity(scene, modelRef, models, manifest);
  if (!entity) {
    return modelNode;
  }

  modelNode.children = prefabSceneNodesFromHierarchy(buildModelContentHierarchy(entity.root));
  entity.root.dispose();
  return modelNode;
}

async function attachSceneHierarchyToModelNode(
  scene: Scene,
  node: PrefabTreeNode,
  models: readonly LodEditorModelEntry[],
  manifest: AssetManifest,
): Promise<void> {
  if (node.kind !== 'model' || !node.slot || !isPrefabModelSlot(node.slot)) return;

  const displayChildren = node.children.filter((child) => child.kind === 'sceneNode');
  const persistableChildren = node.children.filter((child) => child.kind !== 'sceneNode');
  if (displayChildren.length > 0) {
    node.children = [...persistableChildren, ...displayChildren];
    return;
  }

  const entity = await loadManifestModelEntity(scene, node.slot.modelRef, models, manifest);
  if (!entity) {
    node.children = persistableChildren;
    return;
  }

  node.children = [
    ...persistableChildren,
    ...prefabSceneNodesFromHierarchy(buildModelContentHierarchy(entity.root)),
  ];
  entity.root.dispose();
}

/** Rebuild display-only GLB hierarchy under manifest model refs (not persisted). */
export async function hydratePrefabDisplayHierarchy(
  scene: Scene,
  prefab: PrefabEditable,
  models: readonly LodEditorModelEntry[],
  manifest: AssetManifest,
): Promise<void> {
  const modelNodes: PrefabTreeNode[] = [];
  walkPrefabTree(prefab.tree, (node) => {
    if (node.kind === 'model') modelNodes.push(node);
  });

  for (const node of modelNodes) {
    await attachSceneHierarchyToModelNode(scene, node, models, manifest);
  }
}

export { prefabSceneNodesFromHierarchy };
