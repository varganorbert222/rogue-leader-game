import {
  ArcRotateCamera,
  Color4,
  Vector3,
  type AbstractMesh,
  type TransformNode,
} from '@babylonjs/core';
import type { BabylonHost } from '../core/babylon-host';
import { RuntimePaths } from '../runtime-paths';
import { attachVisualPivot } from '../loaders/visual-pivot';
import { LodShipLoader, type LodProgressCallback } from '../loaders/lod-ship-loader';
import { collectDescendantMeshes } from '../loaders/scene-graph-utils';
import { DebugFloor } from '../render/debug-floor';
import { ensureMeshWorldMatrix } from '../render/mesh-world-utils';
import { DevPreviewRendering } from './dev-preview-rendering';
import { buildModelContentHierarchy } from './scene-hierarchy-builder';
import {
  createDefaultViewportState,
  createHierarchyOutlinerState,
  type HierarchyOutlinerState,
} from './hierarchy-outliner';
import { HierarchyViewportSync } from './hierarchy-viewport-sync';
import type { HierarchyNode } from './hierarchy-types';
import type { LodManifestValue } from '../loaders/lod-config';
import { resolvePreviewScale, mergeLodBaseGlbPath } from './lod-editor-types';
import { DevScenePreviewExtras, type HierarchyNodeTransformInfo } from './dev-scene-preview-extras';
import type { DevTransformGizmoMode } from './dev-transform-gizmo';
import type { DevNodeTransform } from './shared/dev-node-transform';

export class EncyclopediaPreviewScene {
  private readonly camera: ArcRotateCamera;
  private readonly lodLoader: LodShipLoader;
  private readonly floor: DebugFloor;
  private readonly devRendering = new DevPreviewRendering();
  private modelRoot: TransformNode | null = null;
  private boundsMeshes: AbstractMesh[] = [];
  private hierarchy: HierarchyNode[] = [];
  private modelId = '';
  private onProgress?: LodProgressCallback;
  private readonly viewportSync = new HierarchyViewportSync(null);
  private defaultViewportState: HierarchyOutlinerState = createHierarchyOutlinerState();
  private readonly previewExtras: DevScenePreviewExtras;
  private loadSeq = 0;

  constructor(
    private readonly host: BabylonHost,
    assetsBaseUrl = RuntimePaths.assetsBase,
  ) {
    const scene = host.scene;
    const canvas = host.engine.getRenderingCanvas()!;

    this.camera = new ArcRotateCamera(
      'encyclopediaCam',
      Math.PI / 4,
      Math.PI / 3,
      12,
      Vector3.Zero(),
      scene,
    );
    this.camera.minZ = 0.05;
    this.camera.wheelPrecision = 20;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(canvas, true);
    scene.activeCamera = this.camera;
    scene.clearColor = new Color4(0.11, 0.11, 0.12, 1);

    this.lodLoader = new LodShipLoader(scene, assetsBaseUrl);
    this.floor = new DebugFloor(scene, {
      center: Vector3.Zero(),
      extent: 40,
      step: 2,
      y: 0,
    });
    this.previewExtras = new DevScenePreviewExtras(scene);
  }

  async initRendering(): Promise<void> {
    await this.devRendering.attach(this.host, this.camera);
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setProgressCallback(callback: LodProgressCallback | undefined): void {
    this.onProgress = callback;
  }

  async loadModel(
    modelId: string,
    lod: LodManifestValue | undefined,
    scale: number | [number, number] | [number, number, number],
    options?: { baseGlbPath?: string },
  ): Promise<void> {
    const loadSeq = ++this.loadSeq;
    this.disposeModel();
    this.modelId = modelId;

    const result = await this.lodLoader.loadWithLod(
      modelId,
      mergeLodBaseGlbPath(lod, options?.baseGlbPath),
      resolvePreviewScale(scale),
      this.onProgress,
    );

    if (loadSeq !== this.loadSeq) {
      result?.root.dispose();
      return;
    }

    if (!result) {
      throw new Error(`Failed to load model "${modelId}"`);
    }

    attachVisualPivot(result.root, this.host.scene);
    this.modelRoot = result.root;
    this.boundsMeshes = result.lodMeshes[0] ?? [];
    const allMeshes = collectDescendantMeshes(result.root);
    this.hierarchy = buildModelContentHierarchy(result.root);
    this.previewExtras.bindAnimations(result.animationGroups);
    this.devRendering.applyEmissiveBloomToMeshes(allMeshes);
    this.viewportSync.setRoot(result.root);
    this.defaultViewportState = createDefaultViewportState(this.hierarchy);
    this.viewportSync.apply(this.hierarchy, this.defaultViewportState);
    this.frameModel();
  }

  getHierarchy(): HierarchyNode[] {
    return this.hierarchy;
  }

  getDefaultViewportState(): HierarchyOutlinerState {
    return this.defaultViewportState;
  }

  applyHierarchyViewport(state: HierarchyOutlinerState): void {
    this.viewportSync.apply(this.hierarchy, state);
  }

  getModelId(): string {
    return this.modelId;
  }

  highlightNode(sceneName: string | undefined): HierarchyNodeTransformInfo | null {
    return this.previewExtras.highlightNode(this.host.scene, this.modelRoot, sceneName);
  }

  clearHighlight(): void {
    this.previewExtras.clearHighlight();
  }

  listAnimations() {
    return this.previewExtras.listAnimations();
  }

  getPlayingAnimationIndex(): number | null {
    return this.previewExtras.getPlayingAnimationIndex();
  }

  playAnimation(index: number): void {
    this.previewExtras.playAnimation(index);
  }

  stopAnimations(): void {
    this.previewExtras.stopAnimations();
  }

  setTransformEditable(editable: boolean): void {
    this.previewExtras.setTransformEditable(editable);
  }

  onTransformGizmoChange(handler: (info: HierarchyNodeTransformInfo) => void): void {
    this.previewExtras.onTransformGizmoChange(handler);
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.previewExtras.setTransformGizmoMode(mode);
  }

  updateSelectedNodeTransform(transform: DevNodeTransform): HierarchyNodeTransformInfo | null {
    return this.previewExtras.updateSelectedNodeTransform(transform);
  }

  private frameModel(): void {
    if (!this.modelRoot || this.boundsMeshes.length === 0) return;

    let min = new Vector3(Infinity, Infinity, Infinity);
    let max = new Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of this.boundsMeshes) {
      ensureMeshWorldMatrix(mesh);
      const box = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, box.minimumWorld);
      max = Vector3.Maximize(max, box.maximumWorld);
    }

    const center = min.add(max).scale(0.5);
    const extent = max.subtract(min);
    const radius = Math.max(extent.x, extent.y, extent.z) * 1.2;

    this.modelRoot.position = this.modelRoot.position.subtract(center);
    this.camera.target.copyFrom(Vector3.Zero());
    this.camera.radius = Math.max(2, radius * 2.5);
    this.camera.alpha = Math.PI / 4;
    this.camera.beta = Math.PI / 3;
  }

  disposeModel(): void {
    this.clearHighlight();
    this.previewExtras.dispose();
    if (this.modelRoot && !this.modelRoot.isDisposed()) {
      this.modelRoot.dispose();
    }
    this.modelRoot = null;
    this.boundsMeshes = [];
    this.hierarchy = [];
    this.viewportSync.setRoot(null);
  }

  dispose(): void {
    ++this.loadSeq;
    this.disposeModel();
    this.floor.dispose();
    this.devRendering.dispose();
    this.camera.dispose();
  }
}
