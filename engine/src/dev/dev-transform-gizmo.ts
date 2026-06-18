import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import type { Scene } from '@babylonjs/core';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  readTransformFromBabylonNode,
  isUniformScale,
  type ParticleNodeTransform,
} from './particle/transform';

export type DevTransformGizmoMode = 'position' | 'rotation' | 'scale' | 'none';

export class DevTransformGizmo {
  private readonly manager: GizmoManager;
  private mode: DevTransformGizmoMode = 'none';
  private attachedNode: TransformNode | null = null;
  private onChange: ((transform: ParticleNodeTransform) => void) | null = null;

  constructor(scene: Scene) {
    this.manager = new GizmoManager(scene);
    this.manager.usePointerToAttachGizmos = false;
    this.manager.clearGizmoOnEmptyPointerEvent = false;
    this.configureGizmoDefaults();
  }

  /** Particle nodes may use non-uniform scale — rotation gizmo must not match mesh rotation. */
  private configureGizmoDefaults(): void {
    this.manager.rotationGizmoEnabled = true;
    const rotation = this.manager.gizmos.rotationGizmo;
    if (rotation) {
      rotation.updateGizmoRotationToMatchAttachedMesh = false;
    }
    this.manager.rotationGizmoEnabled = false;

    this.manager.positionGizmoEnabled = true;
    const position = this.manager.gizmos.positionGizmo;
    if (position) {
      position.updateGizmoRotationToMatchAttachedMesh = false;
    }
    this.manager.positionGizmoEnabled = false;
  }

  setMode(mode: DevTransformGizmoMode): void {
    this.mode = mode;
    this.manager.positionGizmoEnabled = mode === 'position';
    this.manager.rotationGizmoEnabled = mode === 'rotation';
    this.manager.scaleGizmoEnabled = mode === 'scale';
    if (mode === 'rotation') {
      const rotation = this.manager.gizmos.rotationGizmo;
      if (rotation) {
        rotation.updateGizmoRotationToMatchAttachedMesh = false;
      }
    }
    this.wireGizmo(this.manager.gizmos.positionGizmo);
    this.wireGizmo(this.manager.gizmos.rotationGizmo);
    this.wireGizmo(this.manager.gizmos.scaleGizmo);
    this.refreshTransformGizmoAttachment();
  }

  private wired = new WeakSet<object>();

  private wireGizmo(
    gizmo: { onDragEndObservable: { add: (cb: () => void) => void } } | null,
  ): void {
    if (!gizmo || this.wired.has(gizmo)) return;
    gizmo.onDragEndObservable.add(() => this.emitCurrentTransform());
    this.wired.add(gizmo);
  }

  private refreshTransformGizmoAttachment(): void {
    if (!this.attachedNode || !this.onChange || this.mode === 'none') {
      this.manager.attachToNode(null);
      return;
    }
    this.manager.attachToNode(this.attachedNode);
  }

  getMode(): DevTransformGizmoMode {
    return this.mode;
  }

  attach(
    node: TransformNode | null,
    onChange: (transform: ParticleNodeTransform) => void,
  ): void {
    this.attachedNode = node;
    this.onChange = onChange;
    this.refreshTransformGizmoAttachment();
  }

  detach(): void {
    this.attachedNode = null;
    this.onChange = null;
    this.manager.attachToNode(null);
  }

  /** Re-read attached node transform after external (inspector) edits. */
  syncToAttachedNode(transform?: ParticleNodeTransform): void {
    if (!this.attachedNode || this.mode === 'none') return;

    this.attachedNode.computeWorldMatrix(true);

    if (transform && this.mode === 'rotation') {
      const rotation = this.manager.gizmos.rotationGizmo;
      if (rotation) {
        rotation.updateGizmoRotationToMatchAttachedMesh = isUniformScale(transform.scale);
      }
    }

    const node = this.attachedNode;
    this.manager.attachToNode(null);
    this.manager.attachToNode(node);
  }

  dispose(): void {
    this.detach();
    this.manager.dispose();
  }

  private emitCurrentTransform(): void {
    if (!this.attachedNode || !this.onChange) return;
    this.onChange(readTransformFromBabylonNode(this.attachedNode));
  }
}
