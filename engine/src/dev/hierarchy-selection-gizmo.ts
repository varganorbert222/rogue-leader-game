import {
  Mesh,
  TransformNode,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';
import { DebugAxes } from '../render/debug-axes';
import { findSceneNodeByName } from './scene-hierarchy-builder';

export interface HierarchyNodeTransformInfo {
  name: string;
  localPosition: { x: number; y: number; z: number };
  localRotationDeg: { x: number; y: number; z: number };
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function resolveAxisLength(node: TransformNode | AbstractMesh): number {
  if (node instanceof Mesh) {
    node.computeWorldMatrix(true);
    const size = node.getBoundingInfo().boundingBox.extendSize;
    return Math.max(0.12, Math.max(size.x, size.y, size.z) * 0.85);
  }
  return 0.35;
}

/** Local RGB axis gizmo for a selected hierarchy node. */
export class HierarchySelectionGizmo {
  private axes: DebugAxes | null = null;

  highlight(
    scene: Scene,
    root: TransformNode,
    sceneName: string | undefined,
  ): HierarchyNodeTransformInfo | null {
    this.clear();
    if (!sceneName) return null;

    const node = findSceneNodeByName(root, sceneName);
    if (!node || !(node instanceof TransformNode)) return null;

    this.axes = DebugAxes.local(scene, node, resolveAxisLength(node));

    const rotation = node.rotationQuaternion
      ? node.rotationQuaternion.toEulerAngles()
      : node.rotation;

    return {
      name: node.name || sceneName,
      localPosition: {
        x: node.position.x,
        y: node.position.y,
        z: node.position.z,
      },
      localRotationDeg: {
        x: radToDeg(rotation.x),
        y: radToDeg(rotation.y),
        z: radToDeg(rotation.z),
      },
    };
  }

  clear(): void {
    this.axes?.dispose();
    this.axes = null;
  }
}
