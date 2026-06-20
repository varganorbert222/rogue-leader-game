import type { ParticlePresetRefMode } from '../particle/types';
import {
  clonePrefabTree,
  findPrefabTreeNode,
  normalizePrefabTree,
  remapPrefabTreeIds,
  walkPrefabTree,
} from './tree';
import type {
  PrefabContentSlot,
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabModelRef,
  PrefabModelSlot,
  PrefabNestedRef,
  PrefabNestedSlot,
  PrefabParticleRef,
  PrefabParticleSlot,
  PrefabTreeNode,
} from './types';

export function isPrefabModelRef(value: unknown): value is PrefabModelRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as PrefabModelRef;
  return typeof ref.modelId === 'string';
}

export function isPrefabParticleRef(value: unknown): value is PrefabParticleRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as PrefabParticleRef;
  return typeof ref.presetId === 'string' && typeof ref.systemId === 'string';
}

export function isPrefabNestedRef(value: unknown): value is PrefabNestedRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as PrefabNestedRef;
  return (
    typeof ref.prefabId === 'string' &&
    typeof ref.nodeId === 'string' &&
    (ref.mode === 'readonly' || ref.mode === 'edit')
  );
}

export function isPrefabModelSlot(slot: PrefabContentSlot): slot is PrefabModelSlot {
  return 'modelRef' in slot && isPrefabModelRef(slot.modelRef);
}

export function isPrefabParticleSlot(slot: PrefabContentSlot): slot is PrefabParticleSlot {
  return 'particleRef' in slot && isPrefabParticleRef(slot.particleRef);
}

export function isPrefabNestedSlot(slot: PrefabContentSlot): slot is PrefabNestedSlot {
  return 'nestedRef' in slot && isPrefabNestedRef(slot.nestedRef);
}

export function isSlotReadonlyNestedRef(slot: PrefabContentSlot): boolean {
  return isPrefabNestedSlot(slot) && slot.nestedRef.mode === 'readonly';
}

export function isSlotEditNestedRef(slot: PrefabContentSlot): boolean {
  return isPrefabNestedSlot(slot) && slot.nestedRef.mode === 'edit';
}

export function normalizePrefabContentSlot(raw: unknown): PrefabContentSlot {
  const slot = raw as Partial<PrefabContentSlot> & {
    modelRef?: PrefabModelRef;
    particleRef?: PrefabParticleRef;
    nestedRef?: PrefabNestedRef;
  };
  const id = typeof slot.id === 'string' ? slot.id : `node_${Date.now()}`;
  const name = typeof slot.name === 'string' ? slot.name : 'Node';

  if (slot.modelRef && isPrefabModelRef(slot.modelRef)) {
    return {
      id,
      name,
      modelRef: {
        modelId: slot.modelRef.modelId,
        variantId: slot.modelRef.variantId,
      },
    };
  }

  if (slot.particleRef && isPrefabParticleRef(slot.particleRef)) {
    return {
      id,
      name,
      particleRef: {
        presetId: slot.particleRef.presetId,
        systemId: slot.particleRef.systemId,
      },
    };
  }

  if (slot.nestedRef && isPrefabNestedRef(slot.nestedRef)) {
    return {
      id,
      name,
      nestedRef: {
        prefabId: slot.nestedRef.prefabId,
        nodeId: slot.nestedRef.nodeId,
        mode: slot.nestedRef.mode,
      },
    };
  }

  throw new Error('Invalid prefab content slot');
}

export function setNestedRefMode(slot: PrefabNestedSlot, mode: ParticlePresetRefMode): void {
  slot.nestedRef.mode = mode;
}

export function normalizePrefabEditable(prefab: PrefabEditable): PrefabEditable {
  return {
    id: prefab.id,
    name: prefab.name,
    tree: normalizePrefabTree(prefab),
  };
}

export function clonePrefabEditable(prefab: PrefabEditable): PrefabEditable {
  const cloned = JSON.parse(JSON.stringify(prefab)) as PrefabEditable;
  cloned.tree = clonePrefabTree(cloned.tree ?? []);
  return normalizePrefabEditable(cloned);
}

export function resolveNestedSlotToTreeNode(
  slot: PrefabNestedSlot,
  library: readonly PrefabLibraryEntry[],
  visiting = new Set<string>(),
): PrefabTreeNode | null {
  const visitKey = `${slot.nestedRef.prefabId}:${slot.nestedRef.nodeId}`;
  if (visiting.has(visitKey)) return null;
  visiting.add(visitKey);

  const entry = library.find((item) => item.id === slot.nestedRef.prefabId);
  if (!entry) return null;

  const sourceNode = findPrefabTreeNode(entry.prefab.tree, slot.nestedRef.nodeId)?.node ?? null;
  if (!sourceNode) return null;

  if (sourceNode.slot && isPrefabNestedSlot(sourceNode.slot)) {
    return resolveNestedSlotToTreeNode(
      { ...sourceNode.slot, id: slot.id, name: slot.name },
      library,
      visiting,
    );
  }

  const resolved = JSON.parse(JSON.stringify(sourceNode)) as PrefabTreeNode;
  resolved.id = slot.id;
  resolved.name = slot.name;
  if (resolved.slot) {
    resolved.slot.id = slot.id;
    resolved.slot.name = slot.name;
  }
  return resolved;
}

export function detachNestedSlotAsClone(
  slot: PrefabNestedSlot,
  library: readonly PrefabLibraryEntry[],
): PrefabTreeNode | null {
  const resolved = resolveNestedSlotToTreeNode(slot, library);
  if (!resolved) return null;
  const cloned = clonePrefabTree([resolved]);
  remapPrefabTreeIds(cloned);
  return cloned[0] ?? null;
}

export function writeEditNestedRefToLibrary(
  slot: PrefabNestedSlot,
  node: PrefabTreeNode,
  library: PrefabLibraryEntry[],
): boolean {
  if (!slot.nestedRef || slot.nestedRef.mode !== 'edit') return false;

  const entry = library.find((item) => item.id === slot.nestedRef.prefabId);
  if (!entry) return false;

  const editTarget = findPrefabTreeNode(entry.prefab.tree, slot.nestedRef.nodeId)?.node ?? null;
  if (!editTarget) return false;

  editTarget.name = node.name;
  editTarget.transform = JSON.parse(JSON.stringify(node.transform));
  if (editTarget.slot && node.slot) {
    editTarget.slot.name = node.slot.name;
    if (isPrefabModelSlot(node.slot) && isPrefabModelSlot(editTarget.slot)) {
      editTarget.slot.modelRef = { ...node.slot.modelRef };
    }
  }
  return true;
}
