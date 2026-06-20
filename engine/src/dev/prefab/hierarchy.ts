import type { HierarchyNode } from '../hierarchy-types';
import { isPrefabModelSlot, isPrefabNestedSlot, isPrefabParticleSlot } from './refs';
import type { PrefabEditable, PrefabTreeNode } from './types';
import { countPrefabContentNodes, findPrefabTreeNode } from './tree';

function isNestedReadonlyNode(node: PrefabTreeNode): boolean {
  return !!(node.slot && isPrefabNestedSlot(node.slot) && node.slot.nestedRef.mode === 'readonly');
}

function treeNodeToHierarchy(node: PrefabTreeNode, readonlySubtree: boolean): HierarchyNode {
  const inReadonlySubtree = readonlySubtree || isNestedReadonlyNode(node);

  if (node.kind === 'group') {
    return {
      id: node.id,
      label: node.name,
      kind: 'prefabGroup',
      readonlySubtree: inReadonlySubtree || undefined,
      children: node.children.map((child) => treeNodeToHierarchy(child, inReadonlySubtree)),
    };
  }

  if (node.kind === 'sceneNode') {
    return {
      id: node.id,
      label: node.name,
      kind: 'sceneNode',
      sceneName: node.sceneName ?? node.name,
      isGenerated: true,
      readonlySubtree: inReadonlySubtree || undefined,
      children: node.children.map((child) => treeNodeToHierarchy(child, inReadonlySubtree)),
    };
  }

  const slot = node.slot;
  const base: HierarchyNode = {
    id: node.id,
    label: slot?.name ?? node.name,
    kind: node.kind === 'model' ? 'prefabModel' : 'particleSystem',
    readonlySubtree: inReadonlySubtree || undefined,
    children: node.children.map((child) => treeNodeToHierarchy(child, inReadonlySubtree)),
  };

  if (slot && isPrefabNestedSlot(slot)) {
    base.prefabNestedRef = { ...slot.nestedRef };
  } else if (slot && isPrefabModelSlot(slot)) {
    base.modelRef = { ...slot.modelRef };
  } else if (slot && isPrefabParticleSlot(slot)) {
    base.particlePresetRef = {
      presetId: slot.particleRef.presetId,
      systemId: slot.particleRef.systemId,
      mode: 'readonly',
    };
  }

  return base;
}

export function buildPrefabHierarchy(prefab: PrefabEditable): HierarchyNode[] {
  return [
    {
      id: prefab.id,
      label: prefab.name,
      kind: 'prefabRoot',
      children: prefab.tree.map((node) => treeNodeToHierarchy(node, false)),
    },
  ];
}

export function isPrefabHierarchyNodeLocked(node: HierarchyNode): boolean {
  return node.readonlySubtree === true;
}

export function canInsertUnderPrefabHierarchyNode(node: HierarchyNode): boolean {
  if (node.kind === 'sceneNode') return false;
  return !isPrefabHierarchyNodeLocked(node);
}

export function findHierarchyNode(
  nodes: readonly HierarchyNode[],
  nodeId: string,
): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const found = findHierarchyNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
}

export function findHierarchyNodeParent(
  nodes: readonly HierarchyNode[],
  nodeId: string,
  parent: HierarchyNode | null = null,
): HierarchyNode | null | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return parent;
    const found = findHierarchyNodeParent(node.children, nodeId, node);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function canRemovePrefabHierarchyNode(
  hierarchy: readonly HierarchyNode[],
  prefab: PrefabEditable,
  node: HierarchyNode,
): boolean {
  if (node.kind === 'prefabRoot' || node.kind === 'sceneNode') return false;

  if (isPrefabHierarchyNodeLocked(node)) {
    const parent = findHierarchyNodeParent(hierarchy, node.id);
    if (parent && isPrefabHierarchyNodeLocked(parent)) return false;
  }

  if (node.kind !== 'prefabGroup') {
    return countPrefabContentNodes(prefab.tree) > 1;
  }
  return true;
}

export function canDragPrefabHierarchyNode(node: HierarchyNode): boolean {
  if (node.kind === 'prefabRoot') return false;
  return !isPrefabHierarchyNodeLocked(node);
}

export function canReorderPrefabHierarchy(
  hierarchy: readonly HierarchyNode[],
  event: { sourceId: string; targetId: string; position: 'before' | 'after' | 'inside' },
): boolean {
  const source = findHierarchyNode(hierarchy, event.sourceId);
  const target = findHierarchyNode(hierarchy, event.targetId);
  if (!source || !target) return false;
  if (!canDragPrefabHierarchyNode(source)) return false;
  if (isPrefabHierarchyNodeLocked(target)) return false;
  if (event.position === 'inside' && !canInsertUnderPrefabHierarchyNode(target)) return false;
  return true;
}

export function isPrefabNodeInspectorReadonly(node: PrefabTreeNode): boolean {
  if (node.kind === 'sceneNode') return true;
  if (node.kind === 'particleSystem') return true;
  if (node.kind === 'model') return true;
  if (node.slot && isPrefabNestedSlot(node.slot)) {
    return node.slot.nestedRef.mode === 'readonly';
  }
  return false;
}

/** Whether a prefab tree node is inside a read-only nested reference subtree. */
export function isPrefabTreeNodeInReadonlyNestedSubtree(
  prefab: PrefabEditable,
  nodeId: string,
): boolean {
  const located = findPrefabTreeNode(prefab.tree, nodeId);
  if (!located) return false;
  if (isNestedReadonlyNode(located.node)) return true;

  let parent = located.parent;
  while (parent) {
    if (isNestedReadonlyNode(parent)) return true;
    const parentLocated = findPrefabTreeNode(prefab.tree, parent.id);
    parent = parentLocated?.parent ?? null;
  }
  return false;
}
