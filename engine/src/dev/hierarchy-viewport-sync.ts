import { Mesh, type TransformNode } from '@babylonjs/core';
import {
  setColliderMeshWireframeVisible,
  DEV_HIERARCHY_COLLIDER_WIRE_COLOR,
} from '../render/debug/collider-wireframe-debug';
import {
  resolveViewportVisible,
  type HierarchyOutlinerState,
} from './hierarchy-outliner';
import type { HierarchyNode } from './hierarchy-types';
import { findSceneNodeByName } from './scene-hierarchy-builder';

/** Apply hierarchy eye-toggle visibility to a loaded Babylon scene root. */
export class HierarchyViewportSync {
  constructor(private root: TransformNode | null) {}

  setRoot(root: TransformNode | null): void {
    this.root = root;
  }

  apply(nodes: readonly HierarchyNode[], state: HierarchyOutlinerState): void {
    if (!this.root) return;
    this.walk(nodes, [], state);
  }

  private walk(
    nodes: readonly HierarchyNode[],
    ancestors: HierarchyNode[],
    state: HierarchyOutlinerState,
  ): void {
    for (const node of nodes) {
      const visible = resolveViewportVisible(node, ancestors, state);
      this.applyNode(node, visible);
      this.walk(node.children, [...ancestors, node], state);
    }
  }

  private applyNode(node: HierarchyNode, visible: boolean): void {
    if (!this.root || !node.sceneName) return;

    const sceneNode = findSceneNodeByName(this.root, node.sceneName);
    if (!sceneNode) return;

    if (node.kind === 'collider' && sceneNode instanceof Mesh) {
      setColliderMeshWireframeVisible(
        sceneNode,
        visible,
        DEV_HIERARCHY_COLLIDER_WIRE_COLOR,
      );
      return;
    }

    sceneNode.setEnabled(visible);
    if (sceneNode instanceof Mesh && node.kind === 'mesh') {
      sceneNode.isVisible = visible;
      sceneNode.visibility = visible ? 1 : 0;
    }
  }
}
