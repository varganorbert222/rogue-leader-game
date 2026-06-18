import { nextParticleSystemId } from './defaults';
import type { HierarchyReorderEvent } from '../hierarchy-types';
import { normalizeParticleSystemSlot } from './refs';
import type {
  ParticleEffectEditable,
  ParticleEffectTreeNode,
  ParticlePresetEntry,
  ParticlePresetRefMode,
  ParticleSystemSlot,
} from './types';

export type TreeLocateResult = {
  node: ParticleEffectTreeNode;
  parent: ParticleEffectTreeNode | null;
  parentChildren: ParticleEffectTreeNode[];
  index: number;
};

import { defaultNodeTransform, normalizeNodeTransform } from './transform';

let groupIdCounter = 0;

export function nextGroupId(): string {
  groupIdCounter += 1;
  return `grp_${groupIdCounter}`;
}

export function createGroupNode(name = 'Group'): ParticleEffectTreeNode {
  return {
    id: nextGroupId(),
    name,
    kind: 'group',
    children: [],
    transform: defaultNodeTransform(),
  };
}

export function createModuleTreeNode(slot: ParticleSystemSlot): ParticleEffectTreeNode {
  return {
    id: slot.id,
    name: slot.name,
    kind: 'particleSystem',
    children: [],
    transform: defaultNodeTransform(),
    slot,
  };
}

export function systemsToTree(systems: readonly ParticleSystemSlot[]): ParticleEffectTreeNode[] {
  return systems.map((slot) => createModuleTreeNode(normalizeParticleSystemSlot(slot)));
}

export function flattenEffectSlots(tree: readonly ParticleEffectTreeNode[]): ParticleSystemSlot[] {
  const slots: ParticleSystemSlot[] = [];
  walkTree(tree, (node) => {
    if (node.kind === 'particleSystem' && node.slot) {
      slots.push(node.slot);
    }
  });
  return slots;
}

export function countParticleModules(tree: readonly ParticleEffectTreeNode[]): number {
  let count = 0;
  walkTree(tree, (node) => {
    if (node.kind === 'particleSystem') count += 1;
  });
  return count;
}

export function walkTree(
  nodes: readonly ParticleEffectTreeNode[],
  visit: (node: ParticleEffectTreeNode, parent: ParticleEffectTreeNode | null) => void,
  parent: ParticleEffectTreeNode | null = null,
): void {
  for (const node of nodes) {
    visit(node, parent);
    walkTree(node.children, visit, node);
  }
}

export function findTreeNode(
  tree: ParticleEffectTreeNode[],
  nodeId: string,
): TreeLocateResult | null {
  return findTreeNodeInList(tree, nodeId, null);
}

function findTreeNodeInList(
  nodes: ParticleEffectTreeNode[],
  nodeId: string,
  parent: ParticleEffectTreeNode | null,
): TreeLocateResult | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === nodeId) {
      return { node, parent, parentChildren: nodes, index };
    }
    const nested = findTreeNodeInList(node.children, nodeId, node);
    if (nested) return nested;
  }
  return null;
}

export function findSlotInEffect(
  effect: ParticleEffectEditable,
  slotId: string,
): ParticleSystemSlot | null {
  let found: ParticleSystemSlot | null = null;
  walkTree(effect.tree, (node) => {
    if (node.kind === 'particleSystem' && node.slot?.id === slotId) {
      found = node.slot;
    }
  });
  return found;
}

export function findModuleTreeNode(
  effect: ParticleEffectEditable,
  slotId: string,
): ParticleEffectTreeNode | null {
  return findTreeNode(effect.tree, slotId)?.node ?? null;
}

export function insertNodeAfter(
  tree: ParticleEffectTreeNode[],
  anchorId: string,
  node: ParticleEffectTreeNode,
): boolean {
  const located = findTreeNode(tree, anchorId);
  if (!located) return false;
  located.parentChildren.splice(located.index + 1, 0, node);
  return true;
}

export function insertNodeAsLastChild(
  tree: ParticleEffectTreeNode[],
  parentId: string,
  node: ParticleEffectTreeNode,
): boolean {
  const located = findTreeNode(tree, parentId);
  if (!located) return false;
  located.node.children.push(node);
  return true;
}

/** Insert as the last child of the anchor (effect root appends to top-level tree). */
export function insertNodeUnderAnchor(
  effect: ParticleEffectEditable,
  anchorId: string,
  anchorKind: string,
  node: ParticleEffectTreeNode,
): boolean {
  if (anchorKind === 'effectRoot' || anchorId === effect.id) {
    effect.tree.push(node);
    return true;
  }
  return insertNodeAsLastChild(effect.tree, anchorId, node);
}

export function removeTreeNode(
  tree: ParticleEffectTreeNode[],
  nodeId: string,
): ParticleEffectTreeNode | null {
  const located = findTreeNode(tree, nodeId);
  if (!located) return null;
  const [removed] = located.parentChildren.splice(located.index, 1);
  return removed ?? null;
}

export function isTreeDescendant(
  tree: ParticleEffectTreeNode[],
  ancestorId: string,
  nodeId: string,
): boolean {
  const ancestor = findTreeNode(tree, ancestorId);
  if (!ancestor) return false;
  return !!findTreeNode(ancestor.node.children, nodeId);
}

export function moveTreeNode(
  tree: ParticleEffectTreeNode[],
  event: HierarchyReorderEvent,
): boolean {
  if (event.sourceId === event.targetId) return false;
  if (isTreeDescendant(tree, event.sourceId, event.targetId)) return false;

  const source = findTreeNode(tree, event.sourceId);
  const target = findTreeNode(tree, event.targetId);
  if (!source || !target) return false;

  const [moved] = source.parentChildren.splice(source.index, 1);
  if (!moved) return false;

  const targetAfterRemoval = findTreeNode(tree, event.targetId);
  if (!targetAfterRemoval) {
    source.parentChildren.splice(source.index, 0, moved);
    return false;
  }

  if (event.position === 'inside') {
    targetAfterRemoval.node.children.push(moved);
    return true;
  }

  let insertAt = targetAfterRemoval.index;
  if (event.position === 'after') {
    insertAt += 1;
  }
  targetAfterRemoval.parentChildren.splice(insertAt, 0, moved);
  return true;
}

export function normalizeTreeNode(raw: unknown): ParticleEffectTreeNode {
  const node = raw as Partial<ParticleEffectTreeNode>;
  const kind = node.kind === 'group' ? 'group' : 'particleSystem';
  const children = Array.isArray(node.children)
    ? node.children.map((child) => normalizeTreeNode(child))
    : [];

  if (kind === 'group') {
    return {
      id: typeof node.id === 'string' ? node.id : nextParticleSystemId(),
      name: typeof node.name === 'string' ? node.name : 'Group',
      kind: 'group',
      children,
      transform: normalizeNodeTransform(node.transform),
    };
  }

  const slot = node.slot
    ? normalizeParticleSystemSlot(node.slot)
    : normalizeParticleSystemSlot({
        id: node.id,
        name: node.name ?? 'Particle System',
      });

  return {
    id: slot.id,
    name: slot.name,
    kind: 'particleSystem',
    children,
    transform: normalizeNodeTransform(node.transform),
    slot,
  };
}

export function normalizeEffectTree(effect: ParticleEffectEditable): ParticleEffectTreeNode[] {
  if (effect.tree?.length) {
    return effect.tree.map((node) => normalizeTreeNode(node));
  }
  if (effect.systems?.length) {
    return systemsToTree(effect.systems);
  }
  return [];
}

export function syncEffectSystemsFromTree(effect: ParticleEffectEditable): void {
  effect.tree = effect.tree.map((node) => normalizeTreeNode(node));
  effect.systems = flattenEffectSlots(effect.tree);
}

export function cloneEffectTree(tree: readonly ParticleEffectTreeNode[]): ParticleEffectTreeNode[] {
  return JSON.parse(JSON.stringify(tree)) as ParticleEffectTreeNode[];
}

/** Deep-clone one node and its full subtree with fresh ids. */
export function cloneTreeNodeSubtree(node: ParticleEffectTreeNode): ParticleEffectTreeNode {
  const [cloned] = cloneEffectTree([node]);
  remapTreeIds([cloned]);
  return cloned;
}

/** Mirror a catalog preset's full tree with per-module preset references. */
export function buildReferencedPresetTree(
  presetId: string,
  mode: ParticlePresetRefMode,
  catalog: readonly ParticlePresetEntry[],
): ParticleEffectTreeNode[] {
  const preset = catalog.find((entry) => entry.id === presetId);
  if (!preset) return [];
  return preset.effect.tree.map((node) => mirrorTreeNodeAsPresetRef(node, presetId, mode));
}

/** Detached deep copy of a catalog preset's full tree (new ids). */
export function buildClonedPresetTree(
  presetId: string,
  catalog: readonly ParticlePresetEntry[],
): ParticleEffectTreeNode[] {
  const preset = catalog.find((entry) => entry.id === presetId);
  if (!preset) return [];
  const cloned = cloneEffectTree(preset.effect.tree);
  remapTreeIds(cloned);
  return cloned;
}

function mirrorTreeNodeAsPresetRef(
  node: ParticleEffectTreeNode,
  presetId: string,
  mode: ParticlePresetRefMode,
): ParticleEffectTreeNode {
  const children = node.children.map((child) =>
    mirrorTreeNodeAsPresetRef(child, presetId, mode),
  );

  if (node.kind === 'group') {
    return {
      id: nextGroupId(),
      name: node.name,
      kind: 'group',
      transform: normalizeNodeTransform(node.transform),
      children,
    };
  }

  const localId = nextParticleSystemId();
  const moduleName = node.slot?.name ?? node.name;
  return {
    id: localId,
    name: moduleName,
    kind: 'particleSystem',
    transform: normalizeNodeTransform(node.transform),
    children,
    slot: {
      id: localId,
      name: moduleName,
      presetRef: { presetId, systemId: node.id, mode },
    },
  };
}

export function serializeEffectTree(
  tree: readonly ParticleEffectTreeNode[],
): ParticleEffectTreeNode[] {
  return tree.map((node) => serializeTreeNode(node));
}

function serializeTreeNode(node: ParticleEffectTreeNode): ParticleEffectTreeNode {
  const children = node.children.map((child) => serializeTreeNode(child));
  if (node.kind === 'group') {
    return {
      id: node.id,
      name: node.name,
      kind: 'group',
      children,
      transform: normalizeNodeTransform(node.transform),
    };
  }

  const slot = node.slot;
  return {
    id: node.id,
    name: node.name,
    kind: 'particleSystem',
    children,
    transform: normalizeNodeTransform(node.transform),
    slot: slot
      ? slot.presetRef
        ? { id: slot.id, name: slot.name, presetRef: { ...slot.presetRef } }
        : { id: slot.id, name: slot.name, config: slot.config ? { ...slot.config } : undefined }
      : undefined,
  };
}

export function remapTreeIds(tree: ParticleEffectTreeNode[]): void {
  walkTree(tree, (node) => {
    const nextId =
      node.kind === 'group'
        ? `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        : nextParticleSystemId();
    node.id = nextId;
    if (node.kind === 'particleSystem' && node.slot) {
      node.slot.id = nextId;
      if (node.slot.config) {
        node.slot.config.id = nextId;
      }
    }
  });
}
