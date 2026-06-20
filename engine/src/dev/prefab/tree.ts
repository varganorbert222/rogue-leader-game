import type { HierarchyReorderEvent } from '../hierarchy-types';
import type { ParticlePresetRefMode } from '../particle/types';
import { normalizeNodeTransform as normalizeParticleNodeTransform } from '../particle/transform';
import { walkTree as walkParticleTree } from '../particle/tree';
import type { ParticleEffectTreeNode, ParticlePresetEntry } from '../particle/types';
import {
  createPrefabGroupNode,
  createModelTreeNode,
  createParticleTreeNode,
  nextPrefabGroupId,
  nextPrefabNodeId,
} from './defaults';
import {
  isPrefabModelSlot,
  isPrefabNestedSlot,
  isPrefabParticleSlot,
  normalizePrefabContentSlot,
} from './refs';
import {
  defaultPrefabNodeTransform,
  ensurePrefabTreeNodeTransform,
  normalizePrefabNodeTransform,
} from './transform';
import type {
  PrefabContentSlot,
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabNestedSlot,
  PrefabTreeNode,
} from './types';

export type PrefabTreeLocateResult = {
  node: PrefabTreeNode;
  parent: PrefabTreeNode | null;
  parentChildren: PrefabTreeNode[];
  index: number;
};

export function walkPrefabTree(
  nodes: readonly PrefabTreeNode[],
  visit: (node: PrefabTreeNode, parent: PrefabTreeNode | null) => void,
  parent: PrefabTreeNode | null = null,
): void {
  for (const node of nodes) {
    visit(node, parent);
    walkPrefabTree(node.children, visit, node);
  }
}

export function findPrefabTreeNode(
  tree: PrefabTreeNode[],
  nodeId: string,
): PrefabTreeLocateResult | null {
  return findPrefabTreeNodeInList(tree, nodeId, null);
}

function findPrefabTreeNodeInList(
  nodes: PrefabTreeNode[],
  nodeId: string,
  parent: PrefabTreeNode | null,
): PrefabTreeLocateResult | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === nodeId) {
      return { node, parent, parentChildren: nodes, index };
    }
    const nested = findPrefabTreeNodeInList(node.children, nodeId, node);
    if (nested) return nested;
  }
  return null;
}

export function findPrefabSlotById(
  prefab: PrefabEditable,
  slotId: string,
): PrefabContentSlot | null {
  let found: PrefabContentSlot | null = null;
  walkPrefabTree(prefab.tree, (node) => {
    if (node.slot?.id === slotId) {
      found = node.slot;
    }
  });
  return found;
}

export function countPrefabContentNodes(tree: readonly PrefabTreeNode[]): number {
  let count = 0;
  walkPrefabTree(tree, (node) => {
    if (node.kind !== 'group' && node.kind !== 'sceneNode') count += 1;
  });
  return count;
}

export function insertPrefabNodeUnderAnchor(
  prefab: PrefabEditable,
  anchorId: string,
  anchorKind: string,
  node: PrefabTreeNode,
): boolean {
  if (anchorKind === 'prefabRoot' || anchorId === prefab.id) {
    prefab.tree.push(node);
    return true;
  }
  const located = findPrefabTreeNode(prefab.tree, anchorId);
  if (!located) return false;
  located.node.children.push(node);
  return true;
}

export function removePrefabTreeNode(
  tree: PrefabTreeNode[],
  nodeId: string,
): PrefabTreeNode | null {
  const located = findPrefabTreeNode(tree, nodeId);
  if (!located) return null;
  const [removed] = located.parentChildren.splice(located.index, 1);
  return removed ?? null;
}

export function isPrefabTreeDescendant(
  tree: PrefabTreeNode[],
  ancestorId: string,
  nodeId: string,
): boolean {
  const ancestor = findPrefabTreeNode(tree, ancestorId);
  if (!ancestor) return false;
  return !!findPrefabTreeNode(ancestor.node.children, nodeId);
}

export function movePrefabTreeNode(
  tree: PrefabTreeNode[],
  event: HierarchyReorderEvent,
): boolean {
  if (event.sourceId === event.targetId) return false;
  if (isPrefabTreeDescendant(tree, event.sourceId, event.targetId)) return false;

  const source = findPrefabTreeNode(tree, event.sourceId);
  const target = findPrefabTreeNode(tree, event.targetId);
  if (!source || !target) return false;

  const [moved] = source.parentChildren.splice(source.index, 1);
  if (!moved) return false;

  const targetAfterRemoval = findPrefabTreeNode(tree, event.targetId);
  if (!targetAfterRemoval) {
    source.parentChildren.splice(source.index, 0, moved);
    return false;
  }

  if (event.position === 'inside') {
    targetAfterRemoval.node.children.push(moved);
    return true;
  }

  let insertAt = targetAfterRemoval.index;
  if (event.position === 'after') insertAt += 1;
  targetAfterRemoval.parentChildren.splice(insertAt, 0, moved);
  return true;
}

export function normalizePrefabTreeNode(raw: unknown): PrefabTreeNode {
  const node = raw as Partial<PrefabTreeNode>;
  const children = Array.isArray(node.children)
    ? node.children.map((child) => normalizePrefabTreeNode(child))
    : [];

  if (node.kind === 'group') {
    return {
      id: typeof node.id === 'string' ? node.id : nextPrefabGroupId(),
      name: typeof node.name === 'string' ? node.name : 'Group',
      kind: 'group',
      children,
      transform: normalizePrefabNodeTransform(node.transform),
    };
  }

  if (node.kind === 'sceneNode') {
    return {
      id: typeof node.id === 'string' ? node.id : nextPrefabNodeId('scn'),
      name: typeof node.name === 'string' ? node.name : 'Scene Node',
      kind: 'sceneNode',
      sceneName: typeof node.sceneName === 'string' ? node.sceneName : node.name,
      children,
      transform: normalizePrefabNodeTransform(node.transform),
    };
  }

  const kind = node.kind === 'model' ? 'model' : 'particleSystem';
  const slot = node.slot ? normalizePrefabContentSlot(node.slot) : undefined;
  const id = slot?.id ?? (typeof node.id === 'string' ? node.id : nextPrefabNodeId());
  const name = slot?.name ?? (typeof node.name === 'string' ? node.name : 'Node');

  return {
    id,
    name,
    kind,
    children,
    transform: normalizePrefabNodeTransform(node.transform),
    slot,
  };
}

export function normalizePrefabTree(prefab: PrefabEditable): PrefabTreeNode[] {
  if (!prefab.tree?.length) return [];
  return stripSceneNodes(prefab.tree.map((node) => normalizePrefabTreeNode(node)));
}

/** Remove display-only imported GLB rows (not persisted in library.json). */
export function stripSceneNodes(nodes: readonly PrefabTreeNode[]): PrefabTreeNode[] {
  const result: PrefabTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'sceneNode') continue;
    result.push({
      ...node,
      children: stripSceneNodes(node.children),
    });
  }
  return result;
}

export function clonePrefabTree(tree: readonly PrefabTreeNode[]): PrefabTreeNode[] {
  return JSON.parse(JSON.stringify(tree)) as PrefabTreeNode[];
}

export function clonePrefabTreeNodeSubtree(node: PrefabTreeNode): PrefabTreeNode {
  const [cloned] = clonePrefabTree([node]);
  remapPrefabTreeIds([cloned]);
  return cloned;
}

export function remapPrefabTreeIds(tree: PrefabTreeNode[]): void {
  walkPrefabTree(tree, (node) => {
    let nextId: string;
    if (node.kind === 'group') {
      nextId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    } else if (node.kind === 'sceneNode') {
      nextId = nextPrefabNodeId('scn');
    } else {
      nextId = nextPrefabNodeId(node.kind === 'model' ? 'mdl' : 'ps');
    }
    node.id = nextId;
    if (node.slot) {
      node.slot.id = nextId;
    }
  });
}

export function serializePrefabTreeNode(node: PrefabTreeNode): PrefabTreeNode {
  if (node.kind === 'sceneNode') {
    throw new Error('sceneNode must not be serialized');
  }

  const persistableChildren = node.children
    .filter((child) => child.kind !== 'sceneNode')
    .map((child) => serializePrefabTreeNode(child));

  if (node.kind === 'group') {
    return {
      id: node.id,
      name: node.name,
      kind: 'group',
      children: persistableChildren,
      transform: normalizePrefabNodeTransform(node.transform),
    };
  }

  const slot = node.slot;
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    children: [],
    transform: normalizePrefabNodeTransform(node.transform),
    slot: slot ? serializePrefabContentSlot(slot) : undefined,
  };
}

function serializePrefabContentSlot(slot: PrefabContentSlot): PrefabContentSlot {
  if (isPrefabModelSlot(slot)) {
    return {
      id: slot.id,
      name: slot.name,
      modelRef: { ...slot.modelRef },
    };
  }
  if (isPrefabParticleSlot(slot)) {
    return {
      id: slot.id,
      name: slot.name,
      particleRef: { ...slot.particleRef },
    };
  }
  return {
    id: slot.id,
    name: slot.name,
    nestedRef: { ...slot.nestedRef },
  };
}

export function serializePrefabTree(tree: readonly PrefabTreeNode[]): PrefabTreeNode[] {
  return tree.map((node) => serializePrefabTreeNode(node));
}

export function serializePrefabEditable(prefab: PrefabEditable): PrefabEditable {
  return {
    id: prefab.id,
    name: prefab.name,
    tree: serializePrefabTree(prefab.tree),
  };
}

export function serializePrefabLibraryEntry(entry: PrefabLibraryEntry): PrefabLibraryEntry {
  return {
    id: entry.id,
    label: entry.label,
    prefab: serializePrefabEditable(entry.prefab),
  };
}

function mirrorTreeNodeAsNestedRef(
  node: PrefabTreeNode,
  prefabId: string,
  mode: ParticlePresetRefMode,
): PrefabTreeNode {
  const children = node.children.map((child) =>
    mirrorTreeNodeAsNestedRef(child, prefabId, mode),
  );

  if (node.kind === 'group') {
    return {
      id: nextPrefabGroupId(),
      name: node.name,
      kind: 'group',
      transform: normalizePrefabNodeTransform(node.transform),
      children,
    };
  }

  const localId = nextPrefabNodeId(node.kind === 'model' ? 'mdl' : 'ps');
  const slotName = node.slot?.name ?? node.name;
  return {
    id: localId,
    name: slotName,
    kind: node.kind,
    transform: normalizePrefabNodeTransform(node.transform),
    children,
    slot: {
      id: localId,
      name: slotName,
      nestedRef: { prefabId, mode, nodeId: node.id },
    } as PrefabNestedSlot,
  };
}

/** Mirror a library prefab tree with per-node nested references. */
export function buildReferencedPrefabTree(
  prefabId: string,
  mode: ParticlePresetRefMode,
  library: readonly PrefabLibraryEntry[],
): PrefabTreeNode[] {
  const entry = library.find((item) => item.id === prefabId);
  if (!entry) return [];

  return [
    {
      id: nextPrefabGroupId(),
      name: entry.prefab.name,
      kind: 'group',
      transform: defaultPrefabNodeTransform(),
      children: entry.prefab.tree.map((node) => mirrorTreeNodeAsNestedRef(node, prefabId, mode)),
    },
  ];
}

export function buildClonedPrefabTree(
  prefabId: string,
  library: readonly PrefabLibraryEntry[],
): PrefabTreeNode[] {
  const entry = library.find((item) => item.id === prefabId);
  if (!entry) return [];
  const cloned = clonePrefabTree(entry.prefab.tree);
  remapPrefabTreeIds(cloned);
  return cloned;
}

function mirrorParticleTreeNodeAsPrefabRef(
  node: ParticleEffectTreeNode,
  presetId: string,
): PrefabTreeNode {
  const children = node.children.map((child) =>
    mirrorParticleTreeNodeAsPrefabRef(child, presetId),
  );
  const transform = normalizePrefabNodeTransform(
    node.transform ?? normalizeParticleNodeTransform(undefined),
  );

  if (node.kind === 'group') {
    return {
      id: nextPrefabGroupId(),
      name: node.name,
      kind: 'group',
      transform,
      children,
    };
  }

  const localId = nextPrefabNodeId('ps');
  const slotName = node.slot?.name ?? node.name;
  return {
    id: localId,
    name: slotName,
    kind: 'particleSystem',
    transform,
    children,
    slot: {
      id: localId,
      name: slotName,
      particleRef: { presetId, systemId: node.id },
    },
  };
}

/** Mirror a particle preset's full tree as read-only prefab particle references. */
export function buildReferencedParticlePresetTreeForPrefab(
  presetId: string,
  particlePresets: readonly ParticlePresetEntry[],
): PrefabTreeNode[] {
  const preset = particlePresets.find((entry) => entry.id === presetId);
  if (!preset) return [];

  return [
    {
      id: nextPrefabGroupId(),
      name: preset.effect.name,
      kind: 'group',
      transform: defaultPrefabNodeTransform(),
      children: preset.effect.tree.map((node) =>
        mirrorParticleTreeNodeAsPrefabRef(node, presetId),
      ),
    },
  ];
}

export function listParticlePresetOptionsForPrefab(
  particlePresets: readonly ParticlePresetEntry[],
): { presetId: string; label: string }[] {
  return particlePresets.map((preset) => ({
    presetId: preset.id,
    label: preset.label,
  }));
}

export function listParticleModuleOptionsForPrefab(
  particlePresets: readonly ParticlePresetEntry[],
): {
  presetId: string;
  presetLabel: string;
  systemId: string;
  systemName: string;
  catalogLabel: string;
  optionKey: string;
}[] {
  const options: {
    presetId: string;
    presetLabel: string;
    systemId: string;
    systemName: string;
    catalogLabel: string;
    optionKey: string;
  }[] = [];

  for (const preset of particlePresets) {
    walkParticleTree(preset.effect.tree, (node) => {
      if (node.kind === 'particleSystem' && node.slot) {
        options.push({
          presetId: preset.id,
          presetLabel: preset.label,
          systemId: node.id,
          systemName: node.slot.name,
          catalogLabel: `${preset.label} › ${node.slot.name}`,
          optionKey: `${preset.id}:${node.id}`,
        });
      }
    });
  }
  return options;
}

export { ensurePrefabTreeNodeTransform, defaultPrefabNodeTransform };
