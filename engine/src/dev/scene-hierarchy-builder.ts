import { Mesh, TransformNode, type AbstractMesh } from '@babylonjs/core';
import { isHierarchyColliderMesh } from '../loaders/collider-mesh-detector';
import { findVisualRoot } from '../loaders/clone-entity-utils';
import { isSceneNodeGenerated } from '../loaders/scene-node-origin';
import type { HierarchyNode } from './hierarchy-types';

let hierarchyNodeCounter = 0;

function nextNodeId(prefix: string): string {
  hierarchyNodeCounter += 1;
  return `${prefix}_${hierarchyNodeCounter}`;
}

function hasRenderableMeshInSubtree(node: TransformNode | AbstractMesh): boolean {
  for (const child of node.getChildren()) {
    if (child instanceof Mesh) {
      if (!isHierarchyColliderMesh(child) && child.getTotalVertices() > 0) {
        return true;
      }
      if (hasRenderableMeshInSubtree(child)) {
        return true;
      }
    } else if (child instanceof TransformNode) {
      if (hasRenderableMeshInSubtree(child)) {
        return true;
      }
    }
  }
  return false;
}

function classifySceneNode(node: TransformNode | AbstractMesh): {
  kind: HierarchyNode['kind'];
  hiddenInViewportByDefault: boolean;
} {
  const hasMeshDescendants = hasRenderableMeshInSubtree(node);

  if (node instanceof Mesh) {
    if (isHierarchyColliderMesh(node)) {
      return { kind: 'collider', hiddenInViewportByDefault: true };
    }
    if (node.getTotalVertices() === 0) {
      return { kind: 'empty', hiddenInViewportByDefault: !hasMeshDescendants };
    }
    return { kind: 'mesh', hiddenInViewportByDefault: false };
  }

  if (!hasMeshDescendants) {
    return { kind: 'empty', hiddenInViewportByDefault: true };
  }

  return { kind: 'transform', hiddenInViewportByDefault: false };
}

function buildNode(
  node: TransformNode | AbstractMesh,
  idPrefix: string,
): HierarchyNode {
  const id = nextNodeId(idPrefix);
  const { kind, hiddenInViewportByDefault } = classifySceneNode(node);
  const children: HierarchyNode[] = [];

  for (const child of node.getChildren()) {
    if (child instanceof Mesh || child instanceof TransformNode) {
      children.push(buildNode(child, idPrefix));
    }
  }

  return {
    id,
    label: node.name || '(unnamed)',
    kind,
    hiddenInViewportByDefault,
    sceneName: node.name || undefined,
    isGenerated: isSceneNodeGenerated(node),
    children,
  };
}

/** Build a hierarchy tree from a loaded model root. */
export function buildSceneHierarchy(root: TransformNode): HierarchyNode[] {
  return [buildNode(root, 'scene')];
}

function collectHierarchyChildren(parent: TransformNode): (TransformNode | AbstractMesh)[] {
  return parent.getChildren().filter(
    (child): child is TransformNode | AbstractMesh =>
      child instanceof Mesh || child instanceof TransformNode,
  );
}

function isEngineEntityRoot(root: TransformNode): boolean {
  return root.name.endsWith('_root') || root.name.startsWith('placeholder_');
}

/**
 * Build hierarchy for imported model content — skips engine wrappers (`*_root`, `*_visual`).
 * Lists the GLB nodes that are actually rendered under the visual pivot.
 */
export function buildModelContentHierarchy(entityRoot: TransformNode): HierarchyNode[] {
  const visualRoot = findVisualRoot(entityRoot);
  const usesVisualPivot = visualRoot !== entityRoot;
  const contentParent = usesVisualPivot ? visualRoot : entityRoot;
  let nodes = collectHierarchyChildren(contentParent);

  if (!usesVisualPivot && isEngineEntityRoot(entityRoot)) {
    nodes = collectHierarchyChildren(entityRoot);
  }

  if (nodes.length === 0) {
    return [buildNode(entityRoot, 'scene')];
  }

  return nodes.map((node) => buildNode(node, 'scene'));
}

/** Find a Babylon node by matching hierarchical name (depth-first). */
export function findSceneNodeByName(
  root: TransformNode,
  name: string,
): TransformNode | AbstractMesh | null {
  if (root.name === name) return root;

  const stack: TransformNode[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of current.getChildren()) {
      if (child.name === name) {
        return child instanceof Mesh || child instanceof TransformNode ? child : null;
      }
      if (child instanceof TransformNode) {
        stack.push(child);
      } else if (child instanceof Mesh) {
        stack.push(child);
      }
    }
  }
  return null;
}
