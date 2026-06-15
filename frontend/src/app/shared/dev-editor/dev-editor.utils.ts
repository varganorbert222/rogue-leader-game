import {
  BabylonHost,
  cloneHierarchyOutlinerState,
  type HierarchyNode,
  type HierarchyNodeTransformInfo,
  type HierarchyOutlinerState,
  type LodEditorModelEntry,
  type LodEditorModelVariant,
  resolveModelVariantPath,
} from '@rogue-leader/engine';
import type { ChangeDetectorRef } from '@angular/core';
import type { Camera } from '@babylonjs/core';
import { startDevPreviewRenderLoop as engineStartDevPreviewRenderLoop } from '@rogue-leader/engine';

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface DevEditorCanvases {
  preview: HTMLCanvasElement;
  updateAxisGizmo: (camera: Camera) => void;
}

export async function createDevBabylonHost(canvas: HTMLCanvasElement): Promise<BabylonHost> {
  return BabylonHost.create(canvas);
}

export function startDevPreviewRenderLoop(
  host: BabylonHost,
  options: {
    onUpdate?: (dt: number) => void;
    getCamera?: () => Camera | null;
    updateAxisGizmo?: (camera: Camera) => void;
  },
): void {
  engineStartDevPreviewRenderLoop(host, options);
}

export function disposeDevBabylonHost(
  host: BabylonHost | null,
  preview?: { dispose(): void } | null,
): void {
  preview?.dispose();
  host?.dispose();
}

export class LoadSequenceGuard {
  private seq = 0;

  begin(): number {
    this.seq += 1;
    return this.seq;
  }

  isCurrent(token: number): boolean {
    return token === this.seq;
  }
}

export function findModelEntry(
  models: readonly LodEditorModelEntry[],
  modelId: string,
): LodEditorModelEntry | undefined {
  return models.find((model) => model.id === modelId);
}

export function listVariantsForModel(
  models: readonly LodEditorModelEntry[],
  modelId: string,
): LodEditorModelVariant[] {
  return findModelEntry(models, modelId)?.variants ?? [];
}

export function shouldShowVariantPicker(
  models: readonly LodEditorModelEntry[],
  modelId: string,
): boolean {
  return listVariantsForModel(models, modelId).length > 1;
}

export function firstVariantId(
  models: readonly LodEditorModelEntry[],
  modelId: string,
): string {
  return listVariantsForModel(models, modelId)[0]?.id ?? '';
}

export function variantLabel(
  models: readonly LodEditorModelEntry[],
  modelId: string,
  variantId: string,
): string {
  const variants = listVariantsForModel(models, modelId);
  if (variants.length === 0) return '—';
  return variants.find((variant) => variant.id === variantId)?.label ?? variants[0].label;
}

export function resolveCatalogBaseGlbPath(
  models: readonly LodEditorModelEntry[],
  modelId: string,
  variantId: string,
): string | undefined {
  const entry = findModelEntry(models, modelId);
  if (!entry) return undefined;
  return resolveModelVariantPath(entry, variantId);
}

export interface DevSceneHierarchyPreview {
  getHierarchy(): HierarchyNode[];
  getDefaultViewportState(): HierarchyOutlinerState;
  applyHierarchyViewport(state: HierarchyOutlinerState): void;
  listAnimations?(): import('@rogue-leader/engine').DevPreviewAnimationInfo[];
  getPlayingAnimationIndex?(): number | null;
  playAnimation?(index: number): void;
  stopAnimations?(): void;
  highlightNode?(sceneName: string | undefined): import('@rogue-leader/engine').HierarchyNodeTransformInfo | null;
  clearHighlight?(): void;
}

export interface DevSceneHierarchyView {
  hierarchy: HierarchyNode[];
  hierarchyRevision: number;
  selectedNodeId: string;
}

export function beginSceneHierarchyLoad(
  view: DevSceneHierarchyView & { nodeTransform?: HierarchyNodeTransformInfo | null },
  preview?: DevSceneHierarchyPreview,
): void {
  view.selectedNodeId = '';
  view.hierarchy = [];
  view.hierarchyRevision += 1;
  if ('nodeTransform' in view) {
    view.nodeTransform = null;
  }
  preview?.clearHighlight?.();
}

export function commitSceneHierarchyLoad(
  view: DevSceneHierarchyView & {
    animations?: import('@rogue-leader/engine').DevPreviewAnimationInfo[];
    playingAnimationIndex?: number | null;
  },
  preview: DevSceneHierarchyPreview,
): void {
  view.hierarchy = structuredClone(preview.getHierarchy());
  view.hierarchyRevision += 1;
  preview.applyHierarchyViewport(cloneHierarchyOutlinerState(preview.getDefaultViewportState()));
  if (view.animations !== undefined && view.playingAnimationIndex !== undefined) {
    refreshScenePreviewUi(preview, view as { animations: typeof view.animations; playingAnimationIndex: typeof view.playingAnimationIndex });
  }
}

export function failSceneHierarchyLoad(view: DevSceneHierarchyView): void {
  view.hierarchy = [];
  view.hierarchyRevision += 1;
}

export function refreshScenePreviewUi(
  preview: DevSceneHierarchyPreview,
  state: {
    animations: import('@rogue-leader/engine').DevPreviewAnimationInfo[];
    playingAnimationIndex: number | null;
  },
): void {
  state.animations = preview.listAnimations?.() ?? [];
  state.playingAnimationIndex = preview.getPlayingAnimationIndex?.() ?? null;
}

export function hierarchySceneName(node: HierarchyNode): string | undefined {
  return node.sceneName ?? node.label;
}

export async function copyJsonToClipboard(text: string): Promise<'ok' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'ok';
  } catch {
    return 'failed';
  }
}

export function markViewForCheck(cdr?: ChangeDetectorRef): void {
  cdr?.markForCheck();
}
