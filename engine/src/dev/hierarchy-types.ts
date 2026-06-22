/** Serializable tree node for dev-tool hierarchy panels (scene graph, particle effects, …). */
export type HierarchyNodeKind =
  | 'transform'
  | 'mesh'
  | 'empty'
  | 'collider'
  | 'particleSystem'
  | 'effectGroup'
  | 'prefabGroup'
  | 'prefabModel';

export interface HierarchyNode {
  id: string;
  label: string;
  kind: HierarchyNodeKind | string;
  children: HierarchyNode[];
  /** Empty nodes start with viewport visibility off. */
  hiddenInViewportByDefault?: boolean;
  /** Babylon node name for scene-graph visibility sync. */
  sceneName?: string;
  /** Runtime-generated node, not part of the imported source model. */
  isGenerated?: boolean;
  /** Particle editor: catalog reference metadata for hierarchy rows. */
  particlePresetRef?: import('./particle/types').ParticlePresetRef;
  /** Prefab manager: manifest model reference metadata. */
  modelRef?: import('./prefab/types').PrefabModelRef;
  /** Prefab manager: nested prefab reference metadata. */
  prefabNestedRef?: import('./prefab/types').PrefabNestedRef;
  /** Prefab manager: node lives under a read-only nested prefab reference subtree. */
  readonlySubtree?: boolean;
}

export interface HierarchyReorderEvent {
  sourceId: string;
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

/** Reorder a flat sibling list (particle systems under one effect root). */
export function reorderFlatHierarchy(
  nodes: HierarchyNode[],
  event: HierarchyReorderEvent,
): HierarchyNode[] {
  const fromIndex = nodes.findIndex((n) => n.id === event.sourceId);
  const targetIndex = nodes.findIndex((n) => n.id === event.targetId);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
    return nodes;
  }

  const next = [...nodes];
  const [moved] = next.splice(fromIndex, 1);
  let insertAt = targetIndex;
  if (fromIndex < targetIndex) {
    insertAt -= 1;
  }
  if (event.position === 'after') {
    insertAt += 1;
  }
  next.splice(insertAt, 0, moved);
  return next;
}
