import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BabylonHost,
  defaultDistanceThresholds,
  defaultScreenThresholds,
  editableConfigToManifestValue,
  listLodEditorModels,
  loadAssetManifest,
  RuntimePaths,
  LodPreviewScene,
  lodManifestToEditableConfig,
  type DevPreviewAnimationInfo,
  type HierarchyNode,
  type HierarchyNodeTransformInfo,
  type HierarchyOutlinerState,
  type LodConfig,
  type LodEditorModelEntry,
  type LodMetric,
  type LodPreviewLiveState,
  type LodPreviewSnapshot,
} from '@rogue-leader/engine';
import { DevEditorShellComponent } from '../../shared/dev-editor/dev-editor-shell.component';
import { DevEditorStatusComponent } from '../../shared/dev-editor/dev-editor-status.component';
import { DevJsonExportComponent } from '../../shared/dev-editor/dev-json-export.component';
import { DevModelPickerComponent } from '../../shared/dev-editor/dev-model-picker.component';
import { DevSceneHierarchyComponent } from '../../shared/dev-editor/dev-scene-hierarchy.component';
import {
  beginSceneHierarchyLoad,
  commitSceneHierarchyLoad,
  createDevBabylonHost,
  disposeDevBabylonHost,
  failSceneHierarchyLoad,
  findModelEntry,
  firstVariantId,
  hierarchySceneName,
  LoadSequenceGuard,
  refreshScenePreviewUi,
  resolveCatalogBaseGlbPath,
  startDevPreviewRenderLoop,
  toErrorMessage,
  type DevEditorCanvases,
} from '../../shared/dev-editor/dev-editor.utils';

@Component({
  selector: 'app-lod-editor',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    DevEditorShellComponent,
    DevEditorStatusComponent,
    DevModelPickerComponent,
    DevSceneHierarchyComponent,
    DevJsonExportComponent,
  ],
  templateUrl: './lod-editor.component.html',
  styleUrl: './lod-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class LodEditorComponent implements OnInit, OnDestroy {
  models: LodEditorModelEntry[] = [];
  selectedModelId = '';
  selectedVariantId = '';
  loading = true;
  loadingMessage = 'Loading manifest…';
  errorMessage = '';

  config: LodConfig = lodManifestToEditableConfig(undefined);
  pathsText = '';
  autoQualitiesText = '0.55, 0.3, 0.12';
  snapshot: LodPreviewSnapshot | null = null;
  live: LodPreviewLiveState = {
    metric: 'screen',
    coveragePercent: 0,
    cameraDistanceMeters: 0,
    activeLodIndex: 0,
    culled: false,
    cameraRadius: 0,
  };

  previewCoverageSlider = 60;
  exportJson = '';
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  selectedNodeId = '';
  animations: DevPreviewAnimationInfo[] = [];
  playingAnimationIndex: number | null = null;
  nodeTransform: HierarchyNodeTransformInfo | null = null;

  private host: BabylonHost | null = null;
  private preview: LodPreviewScene | null = null;
  private reloadTimer: number | null = null;
  private readonly modelLoads = new LoadSequenceGuard();
  private previewReady = false;

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await loadAssetManifest(RuntimePaths.assetManifest);
      this.models = listLodEditorModels(manifest);
      if (this.models.length > 0) {
        this.selectedModelId = this.models[0].id;
        this.selectedVariantId = firstVariantId(this.models, this.selectedModelId);
      }
      if (this.previewReady && this.selectedModelId) {
        await this.selectModel(this.selectedModelId);
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  async onCanvasReady(canvases: DevEditorCanvases): Promise<void> {
    try {
      this.host = await createDevBabylonHost(canvases.preview);
      this.preview = new LodPreviewScene(this.host);
      await this.preview.initRendering();
      this.preview.setProgressCallback((progress) => {
        this.loadingMessage = progress.message;
      });

      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
        onUpdate: () => {
          if (this.preview && this.snapshot) {
            this.live = this.preview.getLiveState();
          }
        },
      });

      this.previewReady = true;
      if (this.selectedModelId) {
        await this.selectModel(this.selectedModelId);
      } else {
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.reloadTimer != null) {
      window.clearTimeout(this.reloadTimer);
    }
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  isDistanceMetric(): boolean {
    return (this.config.metric ?? 'screen') === 'distance';
  }

  previewScrubMax(): number {
    return this.preview?.getPreviewScrubMax() ?? (this.isDistanceMetric() ? 500 : 100);
  }

  async onModelChange(modelId: string): Promise<void> {
    this.selectedModelId = modelId;
    this.selectedVariantId = firstVariantId(this.models, modelId);
    await this.selectModel(modelId);
  }

  async onVariantChange(variantId: string): Promise<void> {
    this.selectedVariantId = variantId;
    await this.applySelectedVariantToConfig();
    await this.reloadPreview(true);
  }

  private applySelectedVariantToConfig(): void {
    const entry = findModelEntry(this.models, this.selectedModelId);
    if (!entry) return;
    const variantPath = resolveCatalogBaseGlbPath(
      this.models,
      this.selectedModelId,
      this.selectedVariantId,
    );
    if (!variantPath) return;

    this.config.basePath = variantPath;
    if (this.config.paths?.length) {
      this.config.paths[0] = variantPath;
    }
    this.syncPathsFromConfig();
  }

  private async selectModel(modelId: string): Promise<void> {
    const entry = findModelEntry(this.models, modelId);
    if (!entry || !this.preview) return;

    this.config = lodManifestToEditableConfig(entry.lod);
    this.selectedVariantId = firstVariantId(this.models, modelId);
    this.applySelectedVariantToConfig();
    this.syncPathsFromConfig();
    this.syncAutoQualitiesFromConfig();
    this.snapshot = null;
    beginSceneHierarchyLoad(this, this.preview ?? undefined);
    await this.reloadPreview(false);
  }

  onConfigFieldChange(): void {
    this.syncConfigFromPaths();
    this.syncConfigFromAutoQualities();
    this.scheduleReload();
  }

  onMetricChange(): void {
    this.syncThresholdDefaultsForMetric();
    this.onConfigFieldChange();
  }

  onThresholdChange(index: number, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    if (!this.config.screenThresholds) {
      this.config.screenThresholds = [];
    }
    this.config.screenThresholds[index] = parsed;
    this.scheduleReload();
  }

  onDistanceThresholdChange(index: number, value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    if (!this.config.distanceThresholds) {
      this.config.distanceThresholds = [];
    }
    this.config.distanceThresholds[index] = parsed;
    this.scheduleReload();
  }

  onPreviewSliderChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !this.preview) return;
    this.previewCoverageSlider = parsed;
    if (this.isDistanceMetric()) {
      this.preview.previewDistance(parsed);
    } else {
      this.preview.previewCoverage(parsed);
    }
    this.live = this.preview.getLiveState();
  }

  snapToThreshold(index: number): void {
    if (!this.preview || !this.snapshot) return;
    if (this.isDistanceMetric()) {
      const threshold = this.snapshot.distanceThresholds[index];
      if (threshold == null) return;
      this.preview.snapCameraToDistanceThreshold(threshold);
    } else {
      const threshold = this.snapshot.screenThresholds[index];
      if (threshold == null) return;
      this.preview.snapCameraToThreshold(threshold);
    }
    this.live = this.preview.getLiveState();
    this.previewCoverageSlider = this.isDistanceMetric()
      ? this.live.cameraDistanceMeters
      : this.live.coveragePercent;
  }

  snapToCull(): void {
    if (!this.preview || !this.snapshot) return;
    this.preview.previewCull();
    this.live = this.preview.getLiveState();
    this.previewCoverageSlider = this.isDistanceMetric()
      ? this.live.cameraDistanceMeters
      : this.live.coveragePercent;
  }

  resetCamera(): void {
    if (!this.preview) return;
    if (this.isDistanceMetric()) {
      this.previewCoverageSlider = Math.min(80, this.previewScrubMax() * 0.2);
      this.preview.previewDistance(this.previewCoverageSlider);
    } else {
      this.previewCoverageSlider = 60;
      this.preview.previewCoverage(60);
    }
    this.live = this.preview.getLiveState();
  }

  async applyReloadNow(): Promise<void> {
    await this.reloadPreview(true);
  }

  exportManifestSnippet(): void {
    this.syncConfigFromPaths();
    this.syncConfigFromAutoQualities();
    const value = editableConfigToManifestValue(this.config);
    this.exportJson = JSON.stringify(value, null, 2);
  }

  activeLodLabel(): string {
    if (this.live.culled) return 'Culled';
    if (this.live.activeLodIndex < 0) return '—';
    return `LOD ${this.live.activeLodIndex}`;
  }

  lodBarSegments(): { label: string; widthPct: number; tone: string }[] {
    if (!this.snapshot) return [];

    if (this.isDistanceMetric()) {
      return this.lodBarSegmentsDistance();
    }
    return this.lodBarSegmentsScreen();
  }

  private lodBarSegmentsScreen(): { label: string; widthPct: number; tone: string }[] {
    if (!this.snapshot) return [];

    const thresholds = this.snapshot.screenThresholds;
    const cull = this.snapshot.cullScreenPercent;
    const segments: { label: string; widthPct: number; tone: string }[] = [];
    const bounds = [100, ...thresholds, cull, 0];

    for (let i = 0; i < this.snapshot.levelCount; i++) {
      const high = bounds[i];
      const low = i < thresholds.length ? thresholds[i] : cull;
      segments.push({
        label: i === 0 ? 'LOD 0' : `LOD ${i}`,
        widthPct: Math.max(4, high - low),
        tone: `lod-${i % 4}`,
      });
    }

    segments.push({
      label: 'Cull',
      widthPct: Math.max(4, cull),
      tone: 'cull',
    });

    return segments;
  }

  private lodBarSegmentsDistance(): { label: string; widthPct: number; tone: string }[] {
    if (!this.snapshot) return [];

    const thresholds = this.snapshot.distanceThresholds;
    const cull = this.snapshot.cullDistance;
    const segments: { label: string; widthPct: number; tone: string }[] = [];
    const maxSpan = Math.max(cull, ...thresholds, 1);

    let prev = 0;
    for (let i = 0; i < this.snapshot.levelCount; i++) {
      const high = i < thresholds.length ? thresholds[i] : cull;
      segments.push({
        label: i === 0 ? 'LOD 0' : `LOD ${i}`,
        widthPct: Math.max(4, ((high - prev) / maxSpan) * 100),
        tone: `lod-${i % 4}`,
      });
      prev = high;
    }

    segments.push({
      label: 'Cull',
      widthPct: Math.max(4, ((cull - prev) / maxSpan) * 100),
      tone: 'cull',
    });

    return segments;
  }

  onHierarchySelect(node: HierarchyNode): void {
    this.selectedNodeId = node.id;
    if (!this.preview) return;
    this.nodeTransform = this.preview.highlightNode(hierarchySceneName(node));
    refreshScenePreviewUi(this.preview, this);
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

  private scheduleReload(): void {
    if (this.reloadTimer != null) {
      window.clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = window.setTimeout(() => {
      void this.reloadPreview(true);
    }, 450);
  }

  private async reloadPreview(showLoading: boolean): Promise<void> {
    const entry = findModelEntry(this.models, this.selectedModelId);
    if (!entry || !this.preview) return;

    const loadSeq = this.modelLoads.begin();
    this.syncConfigFromPaths();
    this.syncConfigFromAutoQualities();

    if (showLoading) {
      this.loading = true;
      this.errorMessage = '';
      beginSceneHierarchyLoad(this, this.preview ?? undefined);
    }

    try {
      const manifestValue = editableConfigToManifestValue(this.config);
      const baseGlbPath = resolveCatalogBaseGlbPath(
        this.models,
        this.selectedModelId,
        this.selectedVariantId,
      );
      if (this.snapshot?.modelId === entry.id) {
        this.snapshot = await this.preview.reloadWithConfig(this.config, { baseGlbPath });
      } else {
        this.snapshot = await this.preview.loadModelEntry(
          entry.id,
          manifestValue,
          entry.scale,
          { baseGlbPath },
        );
      }
      if (!this.modelLoads.isCurrent(loadSeq)) return;

      this.syncThresholdsFromSnapshot();
      this.exportManifestSnippet();
      this.live = this.preview.getLiveState();
      commitSceneHierarchyLoad(this, this.preview);
      if (this.isDistanceMetric()) {
        this.previewCoverageSlider = this.live.cameraDistanceMeters;
      } else {
        this.previewCoverageSlider = this.live.coveragePercent;
      }
    } catch (err) {
      if (!this.modelLoads.isCurrent(loadSeq)) return;
      if (err instanceof Error && err.message === 'Model load superseded') return;
      this.errorMessage = toErrorMessage(err);
    } finally {
      if (this.modelLoads.isCurrent(loadSeq)) {
        this.loading = false;
      }
    }
  }

  private syncThresholdsFromSnapshot(): void {
    if (!this.snapshot) return;

    if (!this.config.screenThresholds?.length && this.snapshot.levelCount > 1) {
      this.config.screenThresholds = [...this.snapshot.screenThresholds];
    }
    if (!this.config.distanceThresholds?.length && this.snapshot.levelCount > 1) {
      this.config.distanceThresholds = [...this.snapshot.distanceThresholds];
    }
  }

  private syncThresholdDefaultsForMetric(): void {
    const pathCount = this.config.paths?.length ?? 0;
    if (pathCount <= 1 && !this.config.levels?.length) return;

    const levelCount = this.config.levels?.length ?? pathCount;
    if (levelCount <= 1) return;

    if (this.isDistanceMetric() && !this.config.distanceThresholds?.length) {
      this.config.distanceThresholds = defaultDistanceThresholds(levelCount);
    }
    if (!this.isDistanceMetric() && !this.config.screenThresholds?.length) {
      this.config.screenThresholds = defaultScreenThresholds(levelCount);
    }
  }

  private syncPathsFromConfig(): void {
    const paths =
      this.config.paths ??
      this.config.levels
        ?.map((level) => (typeof level === 'string' ? level : 'path' in level ? level.path : null))
        .filter((path): path is string => !!path);
    this.pathsText = (paths ?? []).join('\n');
  }

  private syncAutoQualitiesFromConfig(): void {
    const fromConfig =
      this.config.autoQualities ??
      this.config.levels
        ?.map((level) => (typeof level === 'object' && 'auto' in level ? level.auto : null))
        .filter((value): value is number => value != null);
    if (fromConfig?.length) {
      this.autoQualitiesText = fromConfig.join(', ');
    }
  }

  private syncConfigFromPaths(): void {
    const paths = this.pathsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    this.config.paths = paths;

    if (this.config.mode !== 'mixed' && paths.length > 0) {
      this.config.levels = undefined;
    }

    const levelCount = paths.length;
    if (levelCount <= 1) return;

    if (!this.config.screenThresholds?.length) {
      this.config.screenThresholds = defaultScreenThresholds(levelCount);
    }
    if (!this.config.distanceThresholds?.length) {
      this.config.distanceThresholds = defaultDistanceThresholds(levelCount);
    }
  }

  private syncConfigFromAutoQualities(): void {
    if (this.config.mode === 'auto' || this.config.enableAutoSimplify) {
      const values = this.autoQualitiesText
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value));
      if (values.length) {
        this.config.autoQualities = values;
      }
    }
  }
}

