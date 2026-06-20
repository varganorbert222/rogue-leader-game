import {
  AbstractMesh,
  ArcRotateCamera,
  Color3,
  Color4,
  HemisphericLight,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractEngine,
  type ISceneLoaderAsyncResult,
} from '@babylonjs/core';
import type { ShipManifestEntry } from '../loaders/asset-manifest';
import { collectShipPreviewVisualMeshes } from '../loaders/collider-mesh-detector';
import { attachGltfImportToParent } from '../loaders/gltf-import-utils';
import { resolveLodPlan } from '../loaders/lod-config';
import { createGraphicsEngine } from '../core/backend';
import { ShipPreviewAnimationLoop } from './ship-preview-animation-loop';

const WIREFRAME_COLOR = new Color3(0.35, 0.85, 1);
const BG_COLOR = new Color4(0.02, 0.04, 0.08, 1);

/** Rogue Squadron–style rotating wireframe ship preview for hangar / ship select. */
export class ShipWireframePreviewScene {
  private readonly engine: AbstractEngine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private previewRoot: TransformNode | null = null;
  private activeImport: ISceneLoaderAsyncResult | null = null;
  private loadGeneration = 0;
  private readonly wireMaterials = new Map<AbstractMesh, StandardMaterial>();
  private spin = 0;
  private animationLoop: ShipPreviewAnimationLoop | null = null;

  private constructor(
    engine: AbstractEngine,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.engine = engine;
    this.scene = new Scene(this.engine);
    this.scene.clearColor = BG_COLOR;

    this.camera = new ArcRotateCamera(
      'shipPreviewCam',
      -Math.PI / 2,
      Math.PI / 2.4,
      14,
      Vector3.Zero(),
      this.scene,
    );
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 28;
    this.camera.wheelPrecision = 40;
    this.camera.attachControl(canvas, true);

    const light = new HemisphericLight('previewLight', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.9;
  }

  static async create(canvas: HTMLCanvasElement): Promise<ShipWireframePreviewScene> {
    const { engine } = await createGraphicsEngine(canvas);
    return new ShipWireframePreviewScene(engine, canvas);
  }

  async setShip(
    shipId: string,
    entry: ShipManifestEntry,
    assetsBase: string,
  ): Promise<void> {
    const generation = ++this.loadGeneration;
    this.disposeLoaded();

    const lodPath = resolveLodPlan(entry.lod).levels[0]?.path;
    if (!lodPath) return;

    const url = `${assetsBase.replace(/\/$/, '')}/${lodPath}`;
    const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
    if (generation !== this.loadGeneration) {
      this.disposeImportResult(result);
      return;
    }

    const root = new TransformNode(`${shipId}_preview_root`, this.scene);
    this.previewRoot = root;
    this.activeImport = result;

    const scale = Array.isArray(entry.scale) ? entry.scale[0] : entry.scale;
    root.scaling.setAll(scale);
    attachGltfImportToParent(result, root);

    const visualMeshes = collectShipPreviewVisualMeshes(root);
    for (const mesh of visualMeshes) {
      mesh.isVisible = true;
      mesh.setEnabled(true);
      const mat = new StandardMaterial(`wire_${mesh.name}`, this.scene);
      mat.diffuseColor = WIREFRAME_COLOR;
      mat.emissiveColor = WIREFRAME_COLOR.scale(0.45);
      mat.wireframe = true;
      mat.backFaceCulling = false;
      mesh.material = mat;
      this.wireMaterials.set(mesh, mat);
    }

    this.fitCameraToMeshes(visualMeshes);

    const previewGroups = ShipPreviewAnimationLoop.resolveGroups(
      entry,
      result.animationGroups ?? [],
    );
    if (previewGroups.length > 0) {
      this.animationLoop = new ShipPreviewAnimationLoop(previewGroups, this.scene);
      this.animationLoop.start();
    }
  }

  render(): void {
    this.spin += 0.004;
    if (this.previewRoot) {
      this.previewRoot.rotation.y = this.spin;
    }
    this.scene.render();
  }

  startRenderLoop(): void {
    this.engine.runRenderLoop(() => this.render());
  }

  stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }

  resize(): void {
    this.engine.resize();
  }

  dispose(): void {
    this.stopRenderLoop();
    this.disposeLoaded();
    this.scene.dispose();
    this.engine.dispose();
  }

  private fitCameraToMeshes(meshes: AbstractMesh[]): void {
    if (!meshes.length) return;

    let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bounds.minimumWorld);
      max = Vector3.Maximize(max, bounds.maximumWorld);
    }
    const center = min.add(max).scale(0.5);
    const extent = max.subtract(min);
    const radius = Math.max(extent.x, extent.y, extent.z) * 0.65;
    this.camera.setTarget(center);
    this.camera.radius = Math.max(8, radius * 2.2);
  }

  private disposeLoaded(): void {
    this.animationLoop?.dispose();
    this.animationLoop = null;

    for (const mat of this.wireMaterials.values()) {
      mat.dispose();
    }
    this.wireMaterials.clear();

    if (this.previewRoot && !this.previewRoot.isDisposed()) {
      this.previewRoot.dispose(false, true);
    }
    this.previewRoot = null;

    if (this.activeImport) {
      this.disposeImportExtras(this.activeImport);
      this.activeImport = null;
    }
  }

  private disposeImportExtras(result: ISceneLoaderAsyncResult): void {
    for (const group of result.animationGroups ?? []) {
      group.dispose();
    }
    for (const skeleton of result.skeletons ?? []) {
      skeleton.dispose();
    }
  }

  private disposeImportResult(result: ISceneLoaderAsyncResult): void {
    this.disposeImportExtras(result);
    for (const mesh of [...result.meshes].reverse()) {
      if (!mesh.isDisposed()) mesh.dispose(false, true);
    }
    for (const node of [...(result.transformNodes ?? [])].reverse()) {
      if (!node.isDisposed()) node.dispose(false, true);
    }
  }
}
