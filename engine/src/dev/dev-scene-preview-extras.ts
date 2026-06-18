import type { AnimationGroup, Scene, TransformNode } from '@babylonjs/core';
import { DevPreviewAnimationController } from './dev-preview-animations';
import {
  DevSceneNodeTransformController,
  type HierarchyNodeTransformInfo,
} from './hierarchy-selection-gizmo';
import type { DevTransformGizmoMode } from './dev-transform-gizmo';
import type { DevNodeTransform } from './shared/dev-node-transform';

export type { DevPreviewAnimationInfo } from './dev-preview-animations';
export type { HierarchyNodeTransformInfo } from './hierarchy-selection-gizmo';
export {
  hierarchyTransformToDevNode,
  devNodeToHierarchyTransform,
} from './hierarchy-selection-gizmo';

/** Shared animation + hierarchy selection + transform gizmo for dev preview scenes. */
export class DevScenePreviewExtras {
  private readonly animations = new DevPreviewAnimationController();
  private readonly transformController: DevSceneNodeTransformController;

  constructor(scene: Scene) {
    this.transformController = new DevSceneNodeTransformController(scene);
  }

  setTransformEditable(editable: boolean): void {
    this.transformController.setTransformEditable(editable);
  }

  onTransformGizmoChange(handler: (info: HierarchyNodeTransformInfo) => void): void {
    this.transformController.onTransformGizmoChange(handler);
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.transformController.setTransformGizmoMode(mode);
  }

  getTransformGizmoMode(): DevTransformGizmoMode {
    return this.transformController.getTransformGizmoMode();
  }

  updateSelectedNodeTransform(transform: DevNodeTransform): HierarchyNodeTransformInfo | null {
    return this.transformController.updateSelectedNodeTransform(transform);
  }

  bindAnimations(groups: readonly AnimationGroup[]): void {
    this.animations.setGroups(groups);
  }

  listAnimations() {
    return this.animations.listAnimations();
  }

  getPlayingAnimationIndex(): number | null {
    return this.animations.getPlayingIndex();
  }

  playAnimation(index: number): void {
    this.animations.play(index);
  }

  stopAnimations(): void {
    this.animations.stopAll();
  }

  highlightNode(
    scene: Scene,
    root: TransformNode | null,
    sceneName: string | undefined,
  ): HierarchyNodeTransformInfo | null {
    return this.transformController.highlightNode(scene, root, sceneName);
  }

  clearHighlight(): void {
    this.transformController.clearSelection();
  }

  dispose(): void {
    this.animations.clear();
    this.transformController.dispose();
  }
}
