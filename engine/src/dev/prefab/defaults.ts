import { defaultPrefabNodeTransform } from './transform';
import type {
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabModelSlot,
  PrefabParticleSlot,
  PrefabTreeNode,
} from './types';

let prefabNodeIdCounter = 0;

export function nextPrefabNodeId(prefix = 'node'): string {
  prefabNodeIdCounter += 1;
  return `${prefix}_${prefabNodeIdCounter}`;
}

let groupIdCounter = 0;

export function nextPrefabGroupId(): string {
  groupIdCounter += 1;
  return `grp_${groupIdCounter}`;
}

export function defaultPrefabEditable(name = 'New Prefab'): PrefabEditable {
  const id = `prefab_${Date.now()}`;
  return {
    id,
    name,
    tree: [],
  };
}

export function newBlankPrefabLibraryEntry(): PrefabLibraryEntry {
  const prefab = defaultPrefabEditable('New Prefab');
  return {
    id: prefab.id,
    label: prefab.name,
    prefab,
  };
}

export function createModelSlot(
  modelId: string,
  name: string,
  variantId?: string,
): PrefabModelSlot {
  const id = nextPrefabNodeId('mdl');
  return {
    id,
    name,
    modelRef: { modelId, variantId },
  };
}

export function createParticleSlot(
  presetId: string,
  systemId: string,
  name: string,
): PrefabParticleSlot {
  const id = nextPrefabNodeId('ps');
  return {
    id,
    name,
    particleRef: { presetId, systemId },
  };
}

export function createPrefabGroupNode(name = 'Group'): PrefabTreeNode {
  return {
    id: nextPrefabGroupId(),
    name,
    kind: 'group',
    children: [],
    transform: defaultPrefabNodeTransform(),
  };
}

export function createModelTreeNode(slot: PrefabModelSlot): PrefabTreeNode {
  return {
    id: slot.id,
    name: slot.name,
    kind: 'model',
    children: [],
    transform: defaultPrefabNodeTransform(),
    slot,
  };
}

export function createParticleTreeNode(slot: PrefabParticleSlot): PrefabTreeNode {
  return {
    id: slot.id,
    name: slot.name,
    kind: 'particleSystem',
    children: [],
    transform: defaultPrefabNodeTransform(),
    slot,
  };
}
