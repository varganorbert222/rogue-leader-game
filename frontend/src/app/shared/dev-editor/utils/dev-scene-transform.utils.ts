import type {
  DevNodeTransform,
  DevTransformGizmoMode,
  HierarchyNodeTransformInfo,
} from '@rogue-leader/engine/dev';
import { hierarchyTransformToDevNode } from '@rogue-leader/engine/dev';

export interface DevSceneTransformPreview {
  setTransformEditable?(editable: boolean): void;
  onTransformGizmoChange?(handler: (info: HierarchyNodeTransformInfo) => void): void;
  setTransformGizmoMode?(mode: DevTransformGizmoMode): void;
  updateSelectedNodeTransform?(transform: DevNodeTransform): HierarchyNodeTransformInfo | null;
  highlightNode?(sceneName: string | undefined): HierarchyNodeTransformInfo | null;
}

export interface DevSceneTransformView {
  nodeTransform: HierarchyNodeTransformInfo | null;
  selectionTransform: DevNodeTransform | null;
  transformGizmoMode: DevTransformGizmoMode;
  transformReadonly: boolean;
}

export function syncSceneSelectionTransform(view: DevSceneTransformView): void {
  view.selectionTransform = view.nodeTransform
    ? hierarchyTransformToDevNode(view.nodeTransform)
    : null;
}

export function wireSceneTransformPreview(
  preview: DevSceneTransformPreview,
  view: DevSceneTransformView,
): void {
  preview.setTransformEditable?.(!view.transformReadonly);
  preview.onTransformGizmoChange?.((info) => {
    view.nodeTransform = info;
    syncSceneSelectionTransform(view);
  });
}

export function onSceneSelectionTransformChange(
  preview: DevSceneTransformPreview,
  view: DevSceneTransformView,
): void {
  if (!view.selectionTransform) return;
  const updated = preview.updateSelectedNodeTransform?.(view.selectionTransform);
  if (updated) {
    view.nodeTransform = updated;
    syncSceneSelectionTransform(view);
  }
}

export function onSceneHierarchySelect(
  preview: DevSceneTransformPreview,
  view: DevSceneTransformView,
  sceneName: string | undefined,
): void {
  view.nodeTransform = preview.highlightNode?.(sceneName) ?? null;
  syncSceneSelectionTransform(view);
}

export function setSceneTransformGizmoMode(
  preview: DevSceneTransformPreview,
  view: DevSceneTransformView,
  mode: DevTransformGizmoMode,
): void {
  view.transformGizmoMode = mode;
  preview.setTransformGizmoMode?.(mode);
}
