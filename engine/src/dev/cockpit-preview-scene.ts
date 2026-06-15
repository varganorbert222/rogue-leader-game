import {
  FreeCamera,
  Quaternion,
  Scalar,
  Vector3,
  type TransformNode,
} from '@babylonjs/core';
import type { BabylonHost } from '../core/babylon-host';
import { RuntimePaths } from '../runtime-paths';
import {
  computeCockpitPose,
  createCockpitInputOffsetState,
  resetCockpitInputOffsetState,
  updateCockpitInputOffsetState,
  type CockpitInputOffsetState,
} from '../flight/cockpit-camera';
import { GltfShipLoader, type LoadedEntity } from '../loaders/gltf-ship-loader';
import { LodShipLoader } from '../loaders/lod-ship-loader';
import type { ShipManifestEntry } from '../loaders/asset-manifest';
import { applyCockpitViewMode, loadCockpitForShip, type CockpitAttachment } from '../loaders/cockpit-loader';
import { DebugFloor } from '../render/debug-floor';
import { collectDescendantMeshes } from '../loaders/scene-graph-utils';
import { DevPreviewRendering } from './dev-preview-rendering';
import { buildModelContentHierarchy } from './scene-hierarchy-builder';
import {
  createDefaultViewportState,
  createHierarchyOutlinerState,
  type HierarchyOutlinerState,
} from './hierarchy-outliner';
import { HierarchyViewportSync } from './hierarchy-viewport-sync';
import type { HierarchyNode } from './hierarchy-types';
import {
  editableToResolvedCockpitConfig,
  previewMotionToVehicleInput,
  type CockpitEditableConfig,
  type CockpitPreviewMotion,
} from './cockpit-editor-types';
import { DEFAULT_COCKPIT_FOV_DEG, DEFAULT_COCKPIT_INPUT_RESPONSE } from '../loaders/cockpit-config';
import { BABYLON_MIN_CAMERA_NEAR_Z } from '../render/camera-near-plane';
import { smoothDampedScalar, radToDeg } from '../math';
import { DevScenePreviewExtras, type HierarchyNodeTransformInfo } from './dev-scene-preview-extras';

const PREVIEW_MOTION_SMOOTH_TIME = 0.14;

export interface CockpitPreviewLiveState {
  shipPitchDeg: number;
  shipYawDeg: number;
  speed: number;
  inputOffsetX: number;
  inputOffsetY: number;
  inputOffsetZ: number;
  stickPitch: number;
  stickYaw: number;
  stickThrottle: number;
}

export class CockpitPreviewScene {
  private readonly camera: FreeCamera;
  private readonly shipLoader: GltfShipLoader;
  private readonly floor: DebugFloor;
  private shipRoot: TransformNode | null = null;
  private loaded: LoadedEntity | null = null;
  private cockpit: CockpitAttachment | null = null;
  private config = editableToResolvedCockpitConfig({
    localOffset: [0, 0.15, 0.35],
    localRotationDeg: [0, 0, 0],
    lookYawLimitDeg: 46,
    lookPitchLimitDeg: 29,
    fovDeg: DEFAULT_COCKPIT_FOV_DEG,
    modelPath: '',
    inputResponse: {
      maxInputOffsetRight: DEFAULT_COCKPIT_INPUT_RESPONSE.maxInputOffset[0],
      maxInputOffsetUp: DEFAULT_COCKPIT_INPUT_RESPONSE.maxInputOffset[1],
      maxInputOffsetBack: DEFAULT_COCKPIT_INPUT_RESPONSE.maxInputOffset[2],
      smoothTime: DEFAULT_COCKPIT_INPUT_RESPONSE.smoothTime,
    },
  });
  private motion: CockpitPreviewMotion = {
    pitchRate: 0,
    yawRate: 0,
    thrust: 0,
  };
  private lookYaw = 0;
  private lookPitch = 0;
  private shipPitch = 0;
  private shipYaw = 0;
  private smoothedPitchRate = 0;
  private smoothedYawRate = 0;
  private smoothedPitchRateVel = 0;
  private smoothedYawRateVel = 0;
  private speed = 0;
  private inputOffsetState: CockpitInputOffsetState = createCockpitInputOffsetState();
  private loadingMessage = '';
  private hierarchy: HierarchyNode[] = [];
  private readonly devRendering = new DevPreviewRendering();
  private readonly viewportSync = new HierarchyViewportSync(null);
  private defaultViewportState: HierarchyOutlinerState = createHierarchyOutlinerState();
  private readonly previewExtras = new DevScenePreviewExtras();

  constructor(private readonly host: BabylonHost) {
    const scene = host.scene;
    this.camera = new FreeCamera('cockpitPreviewCam', Vector3.Zero(), scene);
    this.camera.minZ = BABYLON_MIN_CAMERA_NEAR_Z;
    this.camera.inputs.clear();
    scene.activeCamera = this.camera;

    const lodLoader = new LodShipLoader(scene, RuntimePaths.assetsBase);
    this.shipLoader = new GltfShipLoader(scene, RuntimePaths.assetsBase, lodLoader);
    this.floor = new DebugFloor(scene, { center: Vector3.Zero(), extent: 40, step: 5, y: -2 });
  }

  async initRendering(): Promise<void> {
    await this.devRendering.attach(this.host, this.camera);
  }

  getCamera(): FreeCamera {
    return this.camera;
  }

  setProgressCallback(cb: (message: string) => void): void {
    this.shipLoader.setLodProgressCallback((p) => cb(p.message));
  }

  getLoadingMessage(): string {
    return this.loadingMessage;
  }

  async loadShip(shipId: string, entry: ShipManifestEntry): Promise<void> {
    this.disposeShip();
    this.loadingMessage = `Loading ${shipId}…`;
    const loaded = await this.shipLoader.loadShip(shipId, entry);
    const previewEntry: ShipManifestEntry = entry.cockpit
      ? entry
      : {
          ...entry,
          cockpit: {
            localOffset: [...this.config.localOffset],
            localRotationDeg: [...this.config.localRotationDeg],
            lookLimits: { ...this.config.lookLimits },
            fov: this.config.fov,
            inputResponse: { ...this.config.inputResponse },
            ...(this.config.modelPath ? { modelPath: this.config.modelPath } : {}),
          },
        };
    this.cockpit = await loadCockpitForShip(
      this.host.scene,
      RuntimePaths.assetsBase,
      loaded,
      previewEntry,
    );
    this.loaded = loaded;
    this.shipRoot = loaded.root;
    this.shipRoot.position = Vector3.Zero();
    this.shipRoot.rotationQuaternion = Quaternion.Identity();
    applyCockpitViewMode(loaded, this.cockpit ?? undefined, true);
    this.hierarchy = buildModelContentHierarchy(loaded.root);
    this.previewExtras.bindAnimations(loaded.animationGroups);
    this.devRendering.applyEmissiveBloomToMeshes(collectDescendantMeshes(loaded.root));
    this.viewportSync.setRoot(loaded.root);
    this.defaultViewportState = createDefaultViewportState(this.hierarchy);
    this.viewportSync.apply(this.hierarchy, this.defaultViewportState);
    this.loadingMessage = '';
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

  highlightNode(sceneName: string | undefined): HierarchyNodeTransformInfo | null {
    return this.previewExtras.highlightNode(this.host.scene, this.shipRoot, sceneName);
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

  setEditableConfig(editable: CockpitEditableConfig): void {
    this.config = editableToResolvedCockpitConfig(editable);
    this.camera.fov = this.config.fov;
  }

  setPreviewMotion(motion: CockpitPreviewMotion): void {
    this.motion = motion;
  }

  setLookAround(yaw: number, pitch: number): void {
    this.lookYaw = Scalar.Clamp(yaw, -this.config.lookLimits.yaw, this.config.lookLimits.yaw);
    this.lookPitch = Scalar.Clamp(
      pitch,
      -this.config.lookLimits.pitch,
      this.config.lookLimits.pitch,
    );
  }

  update(dt: number): CockpitPreviewLiveState {
    if (!this.shipRoot) {
      return {
        shipPitchDeg: 0,
        shipYawDeg: 0,
        speed: 0,
        inputOffsetX: 0,
        inputOffsetY: 0,
        inputOffsetZ: 0,
        stickPitch: 0,
        stickYaw: 0,
        stickThrottle: 0,
      };
    }

    const pitch = smoothDampedScalar(
      this.smoothedPitchRate,
      this.motion.pitchRate,
      this.smoothedPitchRateVel,
      PREVIEW_MOTION_SMOOTH_TIME,
      dt,
    );
    this.smoothedPitchRate = pitch.value;
    this.smoothedPitchRateVel = pitch.velocity;

    const yaw = smoothDampedScalar(
      this.smoothedYawRate,
      this.motion.yawRate,
      this.smoothedYawRateVel,
      PREVIEW_MOTION_SMOOTH_TIME,
      dt,
    );
    this.smoothedYawRate = yaw.value;
    this.smoothedYawRateVel = yaw.velocity;

    this.shipPitch += this.smoothedPitchRate * dt;
    this.shipYaw += this.smoothedYawRate * dt;
    this.speed = Scalar.Clamp(this.speed + this.motion.thrust * dt * 28, 0, 95);

    const rot = Quaternion.RotationYawPitchRoll(this.shipYaw, this.shipPitch, 0);
    this.shipRoot.rotationQuaternion = rot;

    const vehicleInput = previewMotionToVehicleInput(this.motion);
    updateCockpitInputOffsetState(
      this.inputOffsetState,
      dt,
      this.config.inputResponse,
      vehicleInput,
    );

    const pose = computeCockpitPose(
      this.shipRoot.getAbsolutePosition(),
      rot,
      this.config,
      this.lookYaw,
      this.lookPitch,
      this.inputOffsetState,
    );

    this.camera.position.copyFrom(pose.position);
    this.camera.rotationQuaternion = pose.orientation.clone();
    this.camera.fov = this.config.fov;

    return {
      shipPitchDeg: radToDeg(this.shipPitch),
      shipYawDeg: radToDeg(this.shipYaw),
      speed: this.speed,
      inputOffsetX: this.inputOffsetState.localOffset.x,
      inputOffsetY: this.inputOffsetState.localOffset.y,
      inputOffsetZ: this.inputOffsetState.localOffset.z,
      stickPitch: this.inputOffsetState.smoothedInput.pitch,
      stickYaw: this.inputOffsetState.smoothedInput.yaw,
      stickThrottle: this.inputOffsetState.smoothedInput.throttle,
    };
  }

  dispose(): void {
    this.disposeShip();
    this.floor.dispose();
    this.devRendering.dispose();
    this.camera.dispose();
  }

  private disposeShip(): void {
    this.previewExtras.dispose();
    resetCockpitInputOffsetState(this.inputOffsetState);
    this.smoothedPitchRate = 0;
    this.smoothedYawRate = 0;
    this.smoothedPitchRateVel = 0;
    this.smoothedYawRateVel = 0;
    if (this.shipRoot && !this.shipRoot.isDisposed()) {
      this.shipRoot.dispose();
    }
    this.shipRoot = null;
    this.loaded = null;
    this.cockpit = null;
    this.hierarchy = [];
    this.viewportSync.setRoot(null);
  }
}
