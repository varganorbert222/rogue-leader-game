import type { HierarchyNode } from './hierarchy-types';

export interface HierarchyOutlinerState {
  /** Per-node viewport visibility overrides (`true` = show, `false` = hide). */
  overrides: Map<string, boolean>;
  expanded: Set<string>;
}

export interface HierarchyOutlinerRow {
  node: HierarchyNode;
  depth: number;
  hasChildren: boolean;
  ancestors: HierarchyNode[];
  /** Effective viewport visibility (self + ancestor chain). */
  viewportVisible: boolean;
  /** Self viewport visibility (eye icon state). */
  selfViewportVisible: boolean;
}

export function createHierarchyOutlinerState(): HierarchyOutlinerState {
  return {
    overrides: new Map(),
    expanded: new Set(),
  };
}

export function cloneHierarchyOutlinerState(
  state: HierarchyOutlinerState,
): HierarchyOutlinerState {
  return {
    overrides: new Map(state.overrides),
    expanded: new Set(state.expanded),
  };
}

/** Self viewport visibility (ignores ancestor chain). */
export function resolveNodeSelfViewportVisible(
  node: HierarchyNode,
  state: HierarchyOutlinerState,
): boolean {
  const override = state.overrides.get(node.id);
  if (override !== undefined) return override;
  return !node.hiddenInViewportByDefault;
}

/** Effective viewport visibility including ancestor cascade. */
export function resolveViewportVisible(
  node: HierarchyNode,
  ancestors: readonly HierarchyNode[],
  state: HierarchyOutlinerState,
): boolean {
  for (const ancestor of ancestors) {
    if (!resolveNodeSelfViewportVisible(ancestor, state)) return false;
  }
  return resolveNodeSelfViewportVisible(node, state);
}

export function toggleNodeViewportVisibility(
  node: HierarchyNode,
  state: HierarchyOutlinerState,
): void {
  const next = !resolveNodeSelfViewportVisible(node, state);
  state.overrides.set(node.id, next);
}

/** Flatten the full hierarchy — rows are never removed when toggling visibility. */
export function flattenOutlinerHierarchy(
  nodes: readonly HierarchyNode[],
  state: HierarchyOutlinerState,
  ancestors: HierarchyNode[] = [],
): HierarchyOutlinerRow[] {
  const rows: HierarchyOutlinerRow[] = [];

  for (const node of nodes) {
    const selfViewportVisible = resolveNodeSelfViewportVisible(node, state);
    const viewportVisible = resolveViewportVisible(node, ancestors, state);
    const hasChildren = node.children.length > 0;

    rows.push({
      node,
      depth: ancestors.length,
      hasChildren,
      ancestors: [...ancestors],
      viewportVisible,
      selfViewportVisible,
    });

    if (hasChildren && state.expanded.has(node.id)) {
      rows.push(
        ...flattenOutlinerHierarchy(node.children, state, [...ancestors, node]),
      );
    }
  }

  return rows;
}

export function seedExpandedHierarchyNodes(
  nodes: readonly HierarchyNode[],
  expanded: Set<string>,
): void {
  for (const node of nodes) {
    expanded.add(node.id);
    seedExpandedHierarchyNodes(node.children, expanded);
  }
}

export function createDefaultViewportState(
  nodes: readonly HierarchyNode[],
): HierarchyOutlinerState {
  const state = createHierarchyOutlinerState();
  seedExpandedHierarchyNodes(nodes, state.expanded);
  return state;
}
