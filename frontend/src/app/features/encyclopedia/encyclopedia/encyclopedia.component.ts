import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  BabylonHost,
  EncyclopediaPreviewScene,
  listLodEditorModels,
  loadAssetManifest,
  RuntimePaths,
  type DevPreviewAnimationInfo,
  type HierarchyNode,
  type HierarchyNodeTransformInfo,
  type HierarchyOutlinerState,
  type DevTransformGizmoMode,
  type DevNodeTransform,
  type LodEditorModelEntry,
} from '@rogue-leader/engine';
import { DevEditorShellComponent } from '../../../shared/dev-editor/dev-editor-shell/dev-editor-shell.component';
import { DevEditorStatusComponent } from '../../../shared/dev-editor/dev-editor-status/dev-editor-status.component';
import { DevModelPickerComponent } from '../../../shared/dev-editor/dev-model-picker/dev-model-picker.component';
import { DevSceneHierarchyComponent } from '../../../shared/dev-editor/dev-scene-hierarchy/dev-scene-hierarchy.component';
import { DevInspectorSectionComponent } from '../../../shared/dev-editor/inspectors/dev-inspector-section/dev-inspector-section.component';
import { DevTransformInspectorComponent } from '../../../shared/dev-editor/inspectors/dev-transform-inspector/dev-transform-inspector.component';
import { DevAnimationsInspectorComponent } from '../../../shared/dev-editor/inspectors/dev-animations-inspector/dev-animations-inspector.component';
import {
  onSceneHierarchySelect,
  wireSceneTransformPreview,
  type DevSceneTransformView,
} from '../../../shared/dev-editor/utils/dev-scene-transform.utils';
import {
  beginSceneHierarchyLoad,
  commitSceneHierarchyLoad,
  createDevBabylonHost,
  disposeDevBabylonHost,
  failSceneHierarchyLoad,
  findModelEntry,
  firstVariantId,
  LoadSequenceGuard,
  refreshScenePreviewUi,
  hierarchySceneName,
  markViewForCheck,
  resolveCatalogBaseGlbPath,
  shouldShowVariantPicker,
  startDevPreviewRenderLoop,
  toErrorMessage,
  variantLabel,
  type DevEditorCanvases,
} from '../../../shared/dev-editor/utils/dev-editor.utils';

@Component({
  selector: 'app-encyclopedia',
  standalone: true,
  imports: [
    DevEditorShellComponent,
    DevEditorStatusComponent,
    DevModelPickerComponent,
    DevSceneHierarchyComponent,
    DevInspectorSectionComponent,
    DevTransformInspectorComponent,
    DevAnimationsInspectorComponent,
  ],
  templateUrl: './encyclopedia.component.html',
  styleUrl: './encyclopedia.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class EncyclopediaComponent implements OnInit, OnDestroy {
  models: LodEditorModelEntry[] = [];
  selectedModelId = '';
  selectedVariantId = '';
  selectedNodeId = '';
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  animations: DevPreviewAnimationInfo[] = [];
  playingAnimationIndex: number | null = null;
  nodeTransform: HierarchyNodeTransformInfo | null = null;
  selectionTransform: DevNodeTransform | null = null;
  transformGizmoMode: DevTransformGizmoMode = 'none';
  readonly transformReadonly = true;

  loading = true;
  loadingMessage = 'Loading manifest…';
  errorMessage = '';

  private readonly sceneTransformView: DevSceneTransformView = this;
  private host: BabylonHost | null = null;
  private preview: EncyclopediaPreviewScene | null = null;
  private readonly modelLoads = new LoadSequenceGuard();
  private previewReady = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await loadAssetManifest(RuntimePaths.assetManifest);
      this.models = listLodEditorModels(manifest);
      if (this.models.length > 0) {
        this.selectedModelId = this.models[0].id;
        this.selectedVariantId = firstVariantId(this.models, this.selectedModelId);
      }
      if (this.previewReady) {
        await this.selectModel(this.selectedModelId);
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  async onCanvasReady(canvases: DevEditorCanvases): Promise<void> {
    try {
      this.host = await createDevBabylonHost(canvases.preview);
      this.preview = new EncyclopediaPreviewScene(this.host);
      await this.preview.initRendering();
      this.preview.setProgressCallback((progress) => {
        this.loadingMessage = progress.message;
      });
      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
      });
      this.previewReady = true;
      if (this.preview) {
        wireSceneTransformPreview(this.preview, this.sceneTransformView);
      }

      if (this.models.length > 0 && this.selectedModelId) {
        await this.selectModel(this.selectedModelId);
      } else {
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
      markViewForCheck(this.cdr);
    }
  }

  async onModelChange(modelId: string): Promise<void> {
    this.selectedModelId = modelId;
    this.selectedVariantId = firstVariantId(this.models, modelId);
    await this.selectModel(modelId);
  }

  async onVariantChange(variantId: string): Promise<void> {
    this.selectedVariantId = variantId;
    await this.selectModel(this.selectedModelId);
  }

  showVariantSelector(): boolean {
    return shouldShowVariantPicker(this.models, this.selectedModelId);
  }

  selectedVariantLabel(): string {
    return variantLabel(this.models, this.selectedModelId, this.selectedVariantId);
  }

  onHierarchySelect(node: HierarchyNode): void {
    this.selectedNodeId = node.id;
    if (!this.preview) return;
    onSceneHierarchySelect(this.preview, this.sceneTransformView, hierarchySceneName(node));
    refreshScenePreviewUi(this.preview, this);
    markViewForCheck(this.cdr);
  }

  onHierarchyViewportChange(state: HierarchyOutlinerState): void {
    this.preview?.applyHierarchyViewport(state);
  }

  onPlayAnimation(index: number): void {
    this.preview?.playAnimation(index);
    if (this.preview) refreshScenePreviewUi(this.preview, this);
    markViewForCheck(this.cdr);
  }

  onStopAnimations(): void {
    this.preview?.stopAnimations();
    if (this.preview) refreshScenePreviewUi(this.preview, this);
    markViewForCheck(this.cdr);
  }

  selectedModelLabel(): string {
    return findModelEntry(this.models, this.selectedModelId)?.label ?? '';
  }

  selectedModelKind(): string {
    return findModelEntry(this.models, this.selectedModelId)?.kind ?? '—';
  }

  private async selectModel(modelId: string): Promise<void> {
    const entry = findModelEntry(this.models, modelId);
    if (!entry || !this.preview) return;

    const loadSeq = this.modelLoads.begin();
    this.loading = true;
    this.errorMessage = '';
    beginSceneHierarchyLoad(this, this.preview ?? undefined);

    const baseGlbPath = resolveCatalogBaseGlbPath(this.models, modelId, this.selectedVariantId);

    try {
      await this.preview.loadModel(entry.id, entry.lod, entry.scale, { baseGlbPath });
      if (!this.modelLoads.isCurrent(loadSeq)) return;

      commitSceneHierarchyLoad(this, this.preview);
    } catch (err) {
      if (!this.modelLoads.isCurrent(loadSeq)) return;
      this.errorMessage = toErrorMessage(err);
      failSceneHierarchyLoad(this);
    } finally {
      if (this.modelLoads.isCurrent(loadSeq)) {
        this.loading = false;
      }
      markViewForCheck(this.cdr);
    }
  }
}
