import type { Vec3Editable } from '../shared/editable-primitives';
import type { ParticlePresetRefMode } from '../particle/types';

export interface PrefabNodeTransform {
  position: Vec3Editable;
  rotationDeg: Vec3Editable;
  scale: Vec3Editable;
}

/** Read-only reference to a manifest model (ships / props). */
export interface PrefabModelRef {
  modelId: string;
  variantId?: string;
}

/** Read-only reference to a particle preset module. */
export interface PrefabParticleRef {
  presetId: string;
  systemId: string;
}

/** Reference to another prefab in library.json (Unity-style nested prefab). */
export interface PrefabNestedRef {
  prefabId: string;
  /** Source node id inside the referenced prefab. */
  nodeId: string;
  mode: ParticlePresetRefMode;
}

export interface PrefabModelSlot {
  id: string;
  name: string;
  modelRef: PrefabModelRef;
}

export interface PrefabParticleSlot {
  id: string;
  name: string;
  particleRef: PrefabParticleRef;
}

export interface PrefabNestedSlot {
  id: string;
  name: string;
  nestedRef: PrefabNestedRef;
}

export type PrefabContentSlot = PrefabModelSlot | PrefabParticleSlot | PrefabNestedSlot;

export type PrefabTreeNodeKind = 'group' | 'model' | 'particleSystem' | 'sceneNode';

export interface PrefabTreeNode {
  id: string;
  name: string;
  kind: PrefabTreeNodeKind;
  children: PrefabTreeNode[];
  transform: PrefabNodeTransform;
  slot?: PrefabContentSlot;
  /** Imported GLB scene node name (read-only hierarchy rows). */
  sceneName?: string;
}

export interface PrefabEditable {
  id: string;
  name: string;
  tree: PrefabTreeNode[];
}

export interface PrefabLibraryEntry {
  id: string;
  label: string;
  prefab: PrefabEditable;
}

export interface PrefabLibraryDocument {
  prefabs: PrefabLibraryEntry[];
}
