import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BabylonHost,
  CockpitPreviewScene,
  defaultCockpitEditable,
  listCockpitEditorShips,
  loadAssetManifest,
  loadCockpitEditorOverride,
  RuntimePaths,
  type AssetManifest,
  type CockpitEditableConfig,
  type CockpitPreviewLiveState,
  type CockpitPreviewMotion,
  type DevPreviewAnimationInfo,
  type HierarchyNode,
  type HierarchyNodeTransformInfo,
  type HierarchyOutlinerState,
  type LodEditorModelEntry,
  type DevTransformGizmoMode,
  type DevNodeTransform,
  type Vec3Editable,
} from '@rogue-leader/engine';
import { DevEditorShellComponent } from '../../shared/dev-editor/dev-editor-shell.component';
import { DevJsonCopyComponent } from '../../shared/dev-editor/dev-json-copy.component';
import { DevEditorStatusComponent } from '../../shared/dev-editor/dev-editor-status.component';
import { DevModelPickerComponent } from '../../shared/dev-editor/dev-model-picker.component';
import { DevSceneHierarchyComponent } from '../../shared/dev-editor/dev-scene-hierarchy.component';
import { DevInspectorSectionComponent } from '../../shared/dev-editor/inspectors/dev-inspector-section.component';
import { DevTransformInspectorComponent } from '../../shared/dev-editor/inspectors/dev-transform-inspector.component';
import { DevAnimationsInspectorComponent } from '../../shared/dev-editor/inspectors/dev-animations-inspector.component';
import { DevVec3FieldComponent } from '../../shared/dev-editor/dev-vec3-field.component';
import {
  onSceneHierarchySelect,
  onSceneSelectionTransformChange,
  setSceneTransformGizmoMode,
  syncSceneSelectionTransform,
  wireSceneTransformPreview,
  type DevSceneTransformView,
} from '../../shared/dev-editor/dev-scene-transform.utils';
import {
  beginSceneHierarchyLoad,
  commitSceneHierarchyLoad,
  createDevBabylonHost,
  disposeDevBabylonHost,
  hierarchySceneName,
  refreshScenePreviewUi,
  startDevPreviewRenderLoop,
  toErrorMessage,
  type DevEditorCanvases,
} from '../../shared/dev-editor/dev-editor.utils';

@Component({
  selector: 'app-cockpit-editor',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    DevEditorShellComponent,
    DevEditorStatusComponent,
    DevModelPickerComponent,
    DevSceneHierarchyComponent,
    DevInspectorSectionComponent,
    DevTransformInspectorComponent,
    DevAnimationsInspectorComponent,
    DevVec3FieldComponent,
    DevJsonCopyComponent,
  ],
  templateUrl: './cockpit-editor.component.html',
  styleUrl: './cockpit-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class CockpitEditorComponent implements OnInit, OnDestroy {
  ships: LodEditorModelEntry[] = [];
  selectedShipId = '';
  loading = true;
  loadingMessage = 'Loading manifest…';
  errorMessage = '';

  config: CockpitEditableConfig = defaultCockpitEditable({
    lod: [],
    scale: 1,
    colliderRadius: 1,
  });
  motion: CockpitPreviewMotion = { pitchRate: 0, yawRate: 0, thrust: 0 };
  lookYaw = 0;
  lookPitch = 0;
  live: CockpitPreviewLiveState = {
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
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  selectedNodeId = '';
  animations: DevPreviewAnimationInfo[] = [];
  playingAnimationIndex: number | null = null;
  nodeTransform: HierarchyNodeTransformInfo | null = null;
  selectionTransform: DevNodeTransform | null = null;
  transformGizmoMode: DevTransformGizmoMode = 'none';
  readonly transformReadonly = false;
  readonly cameraOffset: Vec3Editable = { x: 0, y: 0, z: 0 };
  readonly cameraRotationDeg: Vec3Editable = { x: 0, y: 0, z: 0 };

  private readonly sceneTransformView: DevSceneTransformView = this;
  private host: BabylonHost | null = null;
  private preview: CockpitPreviewScene | null = null;
  private manifestShips: AssetManifest['ships'] = {};
  private reloadTimer: number | null = null;
  private keys = new Set<string>();
  private previewReady = false;

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await loadAssetManifest(RuntimePaths.assetManifest);
      this.manifestShips = manifest.ships;
      this.ships = listCockpitEditorShips(manifest);
      if (this.ships.length > 0) {
        this.selectedShipId = this.ships[0].id;
      }
      if (this.previewReady && this.selectedShipId) {
        await this.selectShip(this.selectedShipId);
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  async onCanvasReady(canvases: DevEditorCanvases): Promise<void> {
    try {
      this.host = await createDevBabylonHost(canvases.preview);
      this.preview = new CockpitPreviewScene(this.host);
      await this.preview.initRendering();
      this.preview.setProgressCallback((message) => {
        this.loadingMessage = message;
      });

      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
        onUpdate: (dt) => {
          if (!this.preview) return;
          this.applyKeyboardMotion();
          this.preview.setPreviewMotion(this.motion);
          this.preview.setLookAround(this.lookYaw, this.lookPitch);
          this.live = this.preview.update(dt);
        },
      });

      this.previewReady = true;
      if (this.preview) {
        wireSceneTransformPreview(this.preview, this.sceneTransformView);
      }
      if (this.selectedShipId) {
        await this.selectShip(this.selectedShipId);
      } else {
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.reloadTimer != null) window.clearTimeout(this.reloadTimer);
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.key.toLowerCase());
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  async onShipChange(shipId: string): Promise<void> {
    this.selectedShipId = shipId;
    await this.selectShip(shipId);
  }

  onConfigChange(): void {
    this.schedulePreviewRefresh();
  }

  get cockpitSavePayload(): CockpitEditableConfig {
    return this.config;
  }

  onHierarchySelect(node: HierarchyNode): void {
    this.selectedNodeId = node.id;
    if (!this.preview) return;
    onSceneHierarchySelect(this.preview, this.sceneTransformView, hierarchySceneName(node));
    refreshScenePreviewUi(this.preview, this);
  }

  onSelectionTransformChange(): void {
    if (!this.preview) return;
    onSceneSelectionTransformChange(this.preview, this.sceneTransformView);
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    if (!this.preview) return;
    setSceneTransformGizmoMode(this.preview, this.sceneTransformView, mode);
  }

  onCameraOffsetChange(): void {
    this.config.localOffset = [this.cameraOffset.x, this.cameraOffset.y, this.cameraOffset.z];
    this.onConfigChange();
  }

  onCameraRotationChange(): void {
    this.config.localRotationDeg = [
      this.cameraRotationDeg.x,
      this.cameraRotationDeg.y,
      this.cameraRotationDeg.z,
    ];
    this.onConfigChange();
  }

  private syncCameraVec3FromConfig(): void {
    this.cameraOffset.x = this.config.localOffset[0];
    this.cameraOffset.y = this.config.localOffset[1];
    this.cameraOffset.z = this.config.localOffset[2];
    this.cameraRotationDeg.x = this.config.localRotationDeg[0];
    this.cameraRotationDeg.y = this.config.localRotationDeg[1];
    this.cameraRotationDeg.z = this.config.localRotationDeg[2];
  }

  onHierarchyViewportChange(state: HierarchyOutlinerState): void {
    this.preview?.applyHierarchyViewport(state);
  }

  onPlayAnimation(index: number): void {
    this.preview?.playAnimation(index);
    if (this.preview) refreshScenePreviewUi(this.preview, this);
  }

  onStopAnimations(): void {
    this.preview?.stopAnimations();
    if (this.preview) refreshScenePreviewUi(this.preview, this);
  }

  private async selectShip(shipId: string): Promise<void> {
    const entry = this.manifestShips[shipId];
    if (!entry || !this.preview) return;
    this.motion = { pitchRate: 0, yawRate: 0, thrust: 0 };
    this.loading = true;
    this.errorMessage = '';
    beginSceneHierarchyLoad(this, this.preview ?? undefined);
    this.config = defaultCockpitEditable(entry);
    const override = await loadCockpitEditorOverride(shipId);
    if (override) {
      this.config = { ...this.config, ...override };
    }
    this.syncCameraVec3FromConfig();
    try {
      await this.preview.loadShip(shipId, entry);
      this.preview.setEditableConfig(this.config);
      commitSceneHierarchyLoad(this, this.preview);
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.hierarchy = [];
      this.hierarchyRevision += 1;
    } finally {
      this.loading = false;
    }
  }

  private schedulePreviewRefresh(): void {
    if (this.reloadTimer != null) window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => {
      this.preview?.setEditableConfig(this.config);
      this.reloadTimer = null;
    }, 200);
  }

  private applyKeyboardMotion(): void {
    const pitch = (this.keys.has('s') ? 1 : 0) - (this.keys.has('w') ? 1 : 0);
    const yaw = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const thrust = this.keys.has('shift') ? 1 : this.keys.has('control') ? -1 : 0;
    this.motion = {
      pitchRate: pitch * 0.9,
      yawRate: yaw * 0.9,
      thrust,
    };
    const lookX = (this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('arrowleft') ? 1 : 0);
    const lookY = (this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('arrowdown') ? 1 : 0);
    if (lookX !== 0 || lookY !== 0) {
      this.lookYaw = Math.max(-3, Math.min(3, this.lookYaw + lookX * 0.02));
      this.lookPitch = Math.max(-2, Math.min(2, this.lookPitch + lookY * 0.02));
    }
  }
}
