import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  type LodConfig,
  type LodEditorModelEntry,
  type LodMetric,
  type LodPreviewLiveState,
  type LodPreviewSnapshot,
} from '@rogue-leader/engine';

@Component({
  selector: 'app-lod-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './lod-editor.component.html',
  styleUrl: './lod-editor.component.scss',
})
export class LodEditorComponent implements OnInit, OnDestroy {
  @ViewChild('previewCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  models: LodEditorModelEntry[] = [];
  selectedModelId = '';
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
  copyStatus = '';

  private host: BabylonHost | null = null;
  private preview: LodPreviewScene | null = null;
  private reloadTimer: number | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await loadAssetManifest(RuntimePaths.assetManifest);
      this.models = listLodEditorModels(manifest);
      if (this.models.length > 0) {
        this.selectedModelId = this.models[0].id;
      }

      this.host = await BabylonHost.create(this.canvasRef.nativeElement);
      this.preview = new LodPreviewScene(this.host);
      this.preview.setProgressCallback((progress) => {
        this.loadingMessage = progress.message;
      });

      this.host.startRenderLoop(() => {
        if (this.preview && this.snapshot) {
          this.live = this.preview.getLiveState();
        }
      });

      if (this.selectedModelId) {
        await this.selectModel(this.selectedModelId);
      } else {
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.reloadTimer != null) {
      window.clearTimeout(this.reloadTimer);
    }
    this.preview?.dispose();
    this.host?.dispose();
    this.preview = null;
    this.host = null;
  }

  isDistanceMetric(): boolean {
    return (this.config.metric ?? 'screen') === 'distance';
  }

  previewScrubMax(): number {
    return this.preview?.getPreviewScrubMax() ?? (this.isDistanceMetric() ? 500 : 100);
  }

  async onModelChange(modelId: string): Promise<void> {
    this.selectedModelId = modelId;
    await this.selectModel(modelId);
  }

  private async selectModel(modelId: string): Promise<void> {
    const entry = this.models.find((m) => m.id === modelId);
    if (!entry || !this.preview) return;

    this.config = lodManifestToEditableConfig(entry.lod);
    this.syncPathsFromConfig();
    this.syncAutoQualitiesFromConfig();
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

  async copyExport(): Promise<void> {
    this.exportManifestSnippet();
    try {
      await navigator.clipboard.writeText(this.exportJson);
      this.copyStatus = 'Copied to clipboard';
    } catch {
      this.copyStatus = 'Copy failed — select JSON manually';
    }
    window.setTimeout(() => {
      this.copyStatus = '';
    }, 2500);
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

  private scheduleReload(): void {
    if (this.reloadTimer != null) {
      window.clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = window.setTimeout(() => {
      void this.reloadPreview(true);
    }, 450);
  }

  private async reloadPreview(showLoading: boolean): Promise<void> {
    const entry = this.models.find((m) => m.id === this.selectedModelId);
    if (!entry || !this.preview) return;

    this.syncConfigFromPaths();
    this.syncConfigFromAutoQualities();

    if (showLoading) {
      this.loading = true;
      this.errorMessage = '';
    }

    try {
      const manifestValue = editableConfigToManifestValue(this.config);
      if (this.snapshot) {
        this.snapshot = await this.preview.reloadWithConfig(this.config);
      } else {
        this.snapshot = await this.preview.loadModelEntry(
          entry.id,
          manifestValue,
          entry.scale,
        );
      }
      this.syncThresholdsFromSnapshot();
      this.exportManifestSnippet();
      this.live = this.preview.getLiveState();
      if (this.isDistanceMetric()) {
        this.previewCoverageSlider = this.live.cameraDistanceMeters;
      } else {
        this.previewCoverageSlider = this.live.coveragePercent;
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
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

