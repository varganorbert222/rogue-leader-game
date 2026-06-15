import type { AnimationGroup, Scene, TransformNode } from '@babylonjs/core';
import { DevPreviewAnimationController } from './dev-preview-animations';
import {
  HierarchySelectionGizmo,
  type HierarchyNodeTransformInfo,
} from './hierarchy-selection-gizmo';

export type { DevPreviewAnimationInfo } from './dev-preview-animations';
export type { HierarchyNodeTransformInfo } from './hierarchy-selection-gizmo';

/** Shared animation + hierarchy selection helpers for dev preview scenes. */
export class DevScenePreviewExtras {
  private readonly animations = new DevPreviewAnimationController();
  private readonly selectionGizmo = new HierarchySelectionGizmo();

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
    if (!root) {
      this.selectionGizmo.clear();
      return null;
    }
    return this.selectionGizmo.highlight(scene, root, sceneName);
  }

  clearHighlight(): void {
    this.selectionGizmo.clear();
  }

  dispose(): void {
    this.animations.clear();
    this.selectionGizmo.clear();
  }
}
