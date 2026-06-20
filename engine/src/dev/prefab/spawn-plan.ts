import type { Vec3Editable } from '../shared/editable-primitives';
import {
  isPrefabModelSlot,
  isPrefabNestedSlot,
  isPrefabParticleSlot,
} from './refs';
import { findPrefabTreeNode, walkPrefabTree } from './tree';
import type {
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabModelRef,
  PrefabNodeTransform,
  PrefabParticleRef,
  PrefabTreeNode,
} from './types';

export interface PrefabSpawnTransform {
  position: Vec3Editable;
  rotationDeg: Vec3Editable;
  scale: Vec3Editable;
}

export interface PrefabSpawnModelEntry {
  kind: 'model';
  nodeId: string;
  name: string;
  modelRef: PrefabModelRef;
  transform: PrefabSpawnTransform;
}

export interface PrefabSpawnParticleEntry {
  kind: 'particleSystem';
  nodeId: string;
  name: string;
  particleRef: PrefabParticleRef;
  transform: PrefabSpawnTransform;
}

export type PrefabSpawnEntry = PrefabSpawnModelEntry | PrefabSpawnParticleEntry;

/** Flattened spawn plan for a prefab — suitable for pool prewarm / acquire. */
export interface PrefabSpawnPlan {
  prefabId: string;
  label: string;
  entries: PrefabSpawnEntry[];
}

function cloneTransform(transform: PrefabNodeTransform): PrefabSpawnTransform {
  return JSON.parse(JSON.stringify(transform)) as PrefabSpawnTransform;
}

function resolveNodeForSpawn(
  node: PrefabTreeNode,
  library: readonly PrefabLibraryEntry[],
  visiting: Set<string>,
): PrefabTreeNode | null {
  if (node.slot && isPrefabNestedSlot(node.slot)) {
    const visitKey = `${node.slot.nestedRef.prefabId}:${node.slot.nestedRef.nodeId}`;
    if (visiting.has(visitKey)) return null;
    visiting.add(visitKey);
    const resolved = resolveNestedNode(node.slot, library, visiting);
    if (!resolved) return null;
    return {
      ...resolved,
      transform: node.transform,
      children: resolved.children,
    };
  }
  return node;
}

function resolveNestedNode(
  slot: import('./types').PrefabNestedSlot,
  library: readonly PrefabLibraryEntry[],
  visiting: Set<string>,
): PrefabTreeNode | null {
  const entry = library.find((item) => item.id === slot.nestedRef.prefabId);
  if (!entry) return null;

  const sourceNode = findPrefabTreeNode(entry.prefab.tree, slot.nestedRef.nodeId)?.node ?? null;
  if (!sourceNode) return null;

  if (sourceNode.slot && isPrefabNestedSlot(sourceNode.slot)) {
    return resolveNodeForSpawn(
      { ...sourceNode, slot: { ...sourceNode.slot, id: slot.id, name: slot.name } },
      library,
      visiting,
    );
  }
  return sourceNode;
}

function collectSpawnEntriesFromTree(
  nodes: readonly PrefabTreeNode[],
  library: readonly PrefabLibraryEntry[],
  visiting: Set<string>,
  out: PrefabSpawnEntry[],
): void {
  for (const node of nodes) {
    const resolved = resolveNodeForSpawn(node, library, visiting);
    if (!resolved) continue;

    if (resolved.kind === 'sceneNode') {
      if (resolved.children.length) {
        collectSpawnEntriesFromTree(resolved.children, library, visiting, out);
      }
      continue;
    }

    if (resolved.slot) {
      if (isPrefabModelSlot(resolved.slot)) {
        out.push({
          kind: 'model',
          nodeId: resolved.id,
          name: resolved.slot.name,
          modelRef: { ...resolved.slot.modelRef },
          transform: cloneTransform(resolved.transform),
        });
      } else if (isPrefabParticleSlot(resolved.slot)) {
        out.push({
          kind: 'particleSystem',
          nodeId: resolved.id,
          name: resolved.slot.name,
          particleRef: { ...resolved.slot.particleRef },
          transform: cloneTransform(resolved.transform),
        });
      }
    }

    if (resolved.children.length) {
      collectSpawnEntriesFromTree(resolved.children, library, visiting, out);
    }
  }
}

export function buildPrefabSpawnPlan(
  entry: PrefabLibraryEntry,
  library: readonly PrefabLibraryEntry[],
): PrefabSpawnPlan {
  const entries: PrefabSpawnEntry[] = [];
  collectSpawnEntriesFromTree(entry.prefab.tree, library, new Set(), entries);
  return {
    prefabId: entry.id,
    label: entry.label,
    entries,
  };
}

export function buildPrefabSpawnPlanById(
  prefabId: string,
  library: readonly PrefabLibraryEntry[],
): PrefabSpawnPlan | null {
  const entry = library.find((item) => item.id === prefabId);
  if (!entry) return null;
  return buildPrefabSpawnPlan(entry, library);
}

export function listPrefabSpawnPlans(
  library: readonly PrefabLibraryEntry[],
): PrefabSpawnPlan[] {
  return library.map((entry) => buildPrefabSpawnPlan(entry, library));
}
