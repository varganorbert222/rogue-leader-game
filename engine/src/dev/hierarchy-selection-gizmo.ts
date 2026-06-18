import {
  Mesh,
  TransformNode,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import { DebugAxes } from '../render/debug-axes';
import { findSceneNodeByName } from './scene-hierarchy-builder';
import { DevTransformGizmo, type DevTransformGizmoMode } from './dev-transform-gizmo';
import {
  applyDevNodeTransform,
  readDevNodeTransform,
  type DevNodeTransform,
} from './shared/dev-node-transform';

export interface HierarchyNodeTransformInfo {
  name: string;
  localPosition: { x: number; y: number; z: number };
  localRotationDeg: { x: number; y: number; z: number };
  localScale: { x: number; y: number; z: number };
}

export function hierarchyTransformToDevNode(info: HierarchyNodeTransformInfo): DevNodeTransform {
  return {
    position: { ...info.localPosition },
    rotationDeg: { ...info.localRotationDeg },
    scale: { ...info.localScale },
  };
}

export function devNodeToHierarchyTransform(
  name: string,
  transform: DevNodeTransform,
): HierarchyNodeTransformInfo {
  return {
    name,
    localPosition: { ...transform.position },
    localRotationDeg: { ...transform.rotationDeg },
    localScale: { ...transform.scale },
  };
}

function resolveAxisLength(node: TransformNode | AbstractMesh): number {
  if (node instanceof Mesh) {
    node.computeWorldMatrix(true);
    const size = node.getBoundingInfo().boundingBox.extendSize;
    return Math.max(0.12, Math.max(size.x, size.y, size.z) * 0.85);
  }
  return 0.35;
}

function readHierarchyNodeTransformInfo(
  node: TransformNode,
  sceneName: string,
): HierarchyNodeTransformInfo {
  const dev = readDevNodeTransform(node);
  return devNodeToHierarchyTransform(node.name || sceneName, dev);
}

/** Local RGB axis gizmo + optional interactive transform gizmo for a selected hierarchy node. */
export class HierarchySelectionGizmo {
  private axes: DebugAxes | null = null;

  highlight(
    scene: Scene,
    root: TransformNode,
    sceneName: string | undefined,
  ): { node: TransformNode; info: HierarchyNodeTransformInfo } | null {
    this.clear();
    if (!sceneName) return null;

    const node = findSceneNodeByName(root, sceneName);
    if (!node || !(node instanceof TransformNode)) return null;

    this.axes = DebugAxes.local(scene, node, resolveAxisLength(node));
    return { node, info: readHierarchyNodeTransformInfo(node, sceneName) };
  }

  clear(): void {
    this.axes?.dispose();
    this.axes = null;
  }
}

export class DevSceneNodeTransformController {
  private readonly transformGizmo: DevTransformGizmo;
  private hierarchyRoot: TransformNode | null = null;
  private selectedNode: TransformNode | null = null;
  private selectedName = '';
  private transformEditable = true;
  private transformChangeHandler: ((info: HierarchyNodeTransformInfo) => void) | null = null;
  private readonly selectionGizmo = new HierarchySelectionGizmo();

  constructor(scene: Scene) {
    this.transformGizmo = new DevTransformGizmo(scene);
  }

  setTransformEditable(editable: boolean): void {
    this.transformEditable = editable;
    if (!editable) {
      this.transformGizmo.setMode('none');
    }
    this.refreshTransformGizmoAttachment();
  }

  onTransformGizmoChange(handler: (info: HierarchyNodeTransformInfo) => void): void {
    this.transformChangeHandler = handler;
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    if (!this.transformEditable) return;
    this.transformGizmo.setMode(mode);
    this.refreshTransformGizmoAttachment();
  }

  getTransformGizmoMode(): DevTransformGizmoMode {
    return this.transformGizmo.getMode();
  }

  highlightNode(
    scene: Scene,
    root: TransformNode | null,
    sceneName: string | undefined,
  ): HierarchyNodeTransformInfo | null {
    if (!root) {
      this.clearSelection();
      return null;
    }

    this.hierarchyRoot = root;
    const result = this.selectionGizmo.highlight(scene, root, sceneName);
    if (!result) {
      this.clearSelection();
      return null;
    }

    this.selectedNode = result.node;
    this.selectedName = result.info.name;
    this.refreshTransformGizmoAttachment();
    return result.info;
  }

  updateSelectedNodeTransform(transform: DevNodeTransform): HierarchyNodeTransformInfo | null {
    if (!this.selectedNode || !this.transformEditable) return null;
    applyDevNodeTransform(this.selectedNode, transform);
    const scene = this.selectedNode.getScene();
    if (!scene || !this.hierarchyRoot) {
      return devNodeToHierarchyTransform(this.selectedName, readDevNodeTransform(this.selectedNode));
    }
    const result = this.selectionGizmo.highlight(scene, this.hierarchyRoot, this.selectedNode.name);
    if (result) {
      this.selectedNode = result.node;
      this.selectedName = result.info.name;
    }
    this.transformGizmo.syncToAttachedNode(transform);
    return result?.info ?? devNodeToHierarchyTransform(this.selectedName, transform);
  }

  clearSelection(): void {
    this.hierarchyRoot = null;
    this.selectedNode = null;
    this.selectedName = '';
    this.selectionGizmo.clear();
    this.transformGizmo.detach();
  }

  dispose(): void {
    this.clearSelection();
    this.transformGizmo.dispose();
  }

  private refreshTransformGizmoAttachment(): void {
    if (!this.selectedNode || !this.transformEditable || !this.transformChangeHandler) {
      this.transformGizmo.detach();
      return;
    }

    this.transformGizmo.attach(this.selectedNode, (transform) => {
      if (!this.selectedNode) return;
      const info = devNodeToHierarchyTransform(this.selectedName, transform);
      this.transformChangeHandler?.(info);
      const scene = this.selectedNode.getScene();
      if (scene && this.hierarchyRoot) {
        this.selectionGizmo.highlight(scene, this.hierarchyRoot, this.selectedNode.name);
      }
    });
  }
}
