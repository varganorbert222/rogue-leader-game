import {
  ArcRotateCamera,
  Color4,
  Vector3,
  type AbstractMesh,
  type TransformNode,
} from '@babylonjs/core';
import type { BabylonHost } from '../core/babylon-host';
import { ensureMeshWorldMatrix } from '../render/mesh-world-utils';
import type { LodConfig, LodManifestValue, LodMetric } from '../loaders/lod-config';
import { resolveLodPlan } from '../loaders/lod-config';
import {
  prepareLodMeshGroups,
  resolveDistanceThresholdsForLevelCount,
  resolveThresholdsForLevelCount,
} from '../loaders/lod-babylon';
import {
  createLodRuntimeState,
  updateLod,
  type LodRuntimeState,
} from '../loaders/lod-runtime';
import { LodShipLoader, type LodProgressCallback } from '../loaders/lod-ship-loader';
import { attachVisualPivot } from '../loaders/visual-pivot';
import { computeCameraDistanceMeters } from '../render/lod-distance';
import { computeScreenCoveragePercent } from '../render/screen-coverage';
import { DebugFloor } from '../render/debug-floor';
import {
  editableConfigToManifestValue,
  resolvePreviewScale,
  type LodPreviewLevelInfo,
  type LodPreviewLiveState,
  type LodPreviewSnapshot,
} from './lod-editor-types';

function countVertices(meshes: readonly AbstractMesh[]): number {
  let total = 0;
  for (const mesh of meshes) {
    if (mesh.isDisposed()) continue;
    total += mesh.getTotalVertices();
  }
  return total;
}

function buildLevelInfos(lodMeshes: AbstractMesh[][]): LodPreviewLevelInfo[] {
  return lodMeshes.map((group, index) => ({
    index,
    label: index === 0 ? 'LOD 0' : `LOD ${index}`,
    vertexCount: countVertices(group),
    meshCount: group.length,
  }));
}

export class LodPreviewScene {
  private readonly camera: ArcRotateCamera;
  private readonly lodLoader: LodShipLoader;
  private readonly floor: DebugFloor;
  private modelRoot: TransformNode | null = null;
  private lodMeshes: AbstractMesh[][] = [];
  private boundsMeshes: AbstractMesh[] = [];
  private metric: LodMetric = 'screen';
  private screenThresholds: number[] = [];
  private cullScreenPercent = 2;
  private distanceThresholds: number[] = [];
  private cullDistance = 500;
  private lodRuntime: LodRuntimeState | null = null;
  private modelId = '';
  private lastScale: number | [number, number] | [number, number, number] = 1;
  private onProgress?: LodProgressCallback;

  constructor(
    private readonly host: BabylonHost,
    assetsBaseUrl = '/assets',
  ) {
    const scene = host.scene;
    const canvas = host.engine.getRenderingCanvas()!;

    this.camera = new ArcRotateCamera(
      'lodEditorCam',
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
  }

  setProgressCallback(callback: LodProgressCallback | undefined): void {
    this.onProgress = callback;
  }

  async loadModelEntry(
    modelId: string,
    lod: LodManifestValue | undefined,
    scale: number | [number, number] | [number, number, number],
  ): Promise<LodPreviewSnapshot> {
    this.lastScale = scale;
    return this.loadModel(modelId, lod, scale);
  }

  async loadModel(
    modelId: string,
    lod: LodManifestValue | undefined,
    scale: number | [number, number] | [number, number, number],
  ): Promise<LodPreviewSnapshot> {
    this.disposeModel();
    this.modelId = modelId;

    const result = await this.lodLoader.loadWithLod(
      modelId,
      lod,
      resolvePreviewScale(scale),
      this.onProgress,
    );

    if (!result) {
      throw new Error(`Failed to load model "${modelId}"`);
    }

    attachVisualPivot(result.root, this.host.scene);
    this.modelRoot = result.root;
    this.lodMeshes = result.lodMeshes;
    this.boundsMeshes = result.lodMeshes[0] ?? [];
    this.applyNativeLod(result.root, result.lodMeshes, lod);
    this.frameModel();

    return this.buildSnapshot();
  }

  async reloadWithConfig(config: LodConfig): Promise<LodPreviewSnapshot> {
    if (!this.modelId) {
      throw new Error('No model loaded');
    }
    return this.loadModel(
      this.modelId,
      editableConfigToManifestValue(config),
      this.lastScale,
    );
  }

  private applyNativeLod(
    root: TransformNode,
    lodMeshes: AbstractMesh[][],
    lod: LodManifestValue | undefined,
  ): void {
    const plan = resolveLodPlan(lod);
    this.metric = plan.metric;
    this.screenThresholds = resolveThresholdsForLevelCount(
      plan.screenThresholds,
      lodMeshes.length,
    );
    this.cullScreenPercent = plan.cullScreenPercent;
    this.distanceThresholds = resolveDistanceThresholdsForLevelCount(
      plan.distanceThresholds,
      lodMeshes.length,
    );
    this.cullDistance = plan.cullDistance;

    prepareLodMeshGroups(lodMeshes);
    this.lodRuntime = createLodRuntimeState(
      root,
      lodMeshes,
      lodMeshes[0] ?? [],
      {
        metric: plan.metric,
        screenThresholds: this.screenThresholds,
        cullScreenPercent: this.cullScreenPercent,
        distanceThresholds: this.distanceThresholds,
        cullDistance: this.cullDistance,
      },
    );
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

  previewCoverage(targetPercent: number): void {
    if (this.boundsMeshes.length === 0 || !this.modelRoot) return;
    this.findCameraRadiusForCoverage(targetPercent, 'exact');
  }

  previewDistance(targetMeters: number): void {
    if (!this.modelRoot) return;
    this.camera.radius = Math.max(0.05, targetMeters);
  }

  /** Snap to the farthest distance where coverage is still at/above the cull threshold. */
  previewCull(): void {
    if (this.boundsMeshes.length === 0 || !this.modelRoot) return;
    if (this.metric === 'distance') {
      this.previewDistance(this.cullDistance);
      return;
    }
    this.findCameraRadiusForCoverage(this.cullScreenPercent, 'at-or-above');
  }

  snapCameraToThreshold(thresholdPercent: number): void {
    this.findCameraRadiusForCoverage(thresholdPercent, 'at-or-above');
  }

  snapCameraToDistanceThreshold(thresholdMeters: number): void {
    this.previewDistance(thresholdMeters);
  }

  getMetric(): LodMetric {
    return this.metric;
  }

  getPreviewScrubMax(): number {
    return this.metric === 'distance'
      ? Math.max(this.cullDistance * 1.05, 50)
      : 100;
  }

  private measureCoverage(): number {
    this.host.scene.updateTransformMatrix(true);
    for (const mesh of this.boundsMeshes) {
      if (mesh.isDisposed()) continue;
      ensureMeshWorldMatrix(mesh);
    }
    return computeScreenCoveragePercent(
      this.host.scene,
      this.modelRoot!,
      this.boundsMeshes,
    );
  }

  private measureDistance(): number {
    this.host.scene.updateTransformMatrix(true);
    for (const mesh of this.boundsMeshes) {
      if (mesh.isDisposed()) continue;
      ensureMeshWorldMatrix(mesh);
    }
    return computeCameraDistanceMeters(
      this.host.scene,
      this.modelRoot!,
      this.boundsMeshes,
    );
  }

  private bracketCoverageRange(targetPercent: number): { lo: number; hi: number } {
    let lo = 0.2;
    this.camera.radius = lo;
    let coverage = this.measureCoverage();
    while (coverage < targetPercent && lo > 0.01) {
      lo *= 0.5;
      this.camera.radius = lo;
      coverage = this.measureCoverage();
    }

    let hi = Math.max(lo * 2, lo + 1);
    this.camera.radius = hi;
    coverage = this.measureCoverage();
    while (coverage > targetPercent && hi < 1e6) {
      hi *= 2;
      this.camera.radius = hi;
      coverage = this.measureCoverage();
    }

    return { lo, hi };
  }

  private findCameraRadiusForCoverage(
    targetPercent: number,
    mode: 'exact' | 'at-or-above',
  ): void {
    const { lo: startLo, hi: startHi } = this.bracketCoverageRange(targetPercent);
    let lo = startLo;
    let hi = startHi;

    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) * 0.5;
      this.camera.radius = mid;
      const coverage = this.measureCoverage();

      if (mode === 'exact') {
        if (coverage > targetPercent) lo = mid;
        else hi = mid;
        continue;
      }

      if (coverage >= targetPercent) lo = mid;
      else hi = mid;
    }

    this.camera.radius = mode === 'exact' ? (lo + hi) * 0.5 : lo;
  }

  getLiveState(): LodPreviewLiveState {
    if (!this.modelRoot) {
      return {
        metric: this.metric,
        coveragePercent: 0,
        cameraDistanceMeters: 0,
        activeLodIndex: -1,
        culled: true,
        cameraRadius: this.camera.radius,
      };
    }

    this.host.scene.updateTransformMatrix(true);
    if (this.lodRuntime) {
      updateLod(this.host.scene, this.lodRuntime);
    }

    const coveragePercent = computeScreenCoveragePercent(
      this.host.scene,
      this.modelRoot,
      this.boundsMeshes,
    );
    const cameraDistanceMeters = computeCameraDistanceMeters(
      this.host.scene,
      this.modelRoot,
      this.boundsMeshes,
    );
    const activeLodIndex = this.lodRuntime?.activeLodIndex ?? -1;

    return {
      metric: this.metric,
      coveragePercent,
      cameraDistanceMeters,
      activeLodIndex,
      culled: activeLodIndex < 0,
      cameraRadius: this.camera.radius,
    };
  }

  buildSnapshot(): LodPreviewSnapshot {
    return {
      modelId: this.modelId,
      levelCount: this.lodMeshes.length,
      levels: buildLevelInfos(this.lodMeshes),
      metric: this.metric,
      screenThresholds: [...this.screenThresholds],
      cullScreenPercent: this.cullScreenPercent,
      distanceThresholds: [...this.distanceThresholds],
      cullDistance: this.cullDistance,
    };
  }

  getSnapshot(): LodPreviewSnapshot {
    return this.buildSnapshot();
  }

  disposeModel(): void {
    if (this.modelRoot && !this.modelRoot.isDisposed()) {
      this.modelRoot.dispose();
    }
    this.modelRoot = null;
    this.lodMeshes = [];
    this.boundsMeshes = [];
    this.lodRuntime = null;
  }

  dispose(): void {
    this.disposeModel();
    this.floor.dispose();
    this.camera.dispose();
  }
}

