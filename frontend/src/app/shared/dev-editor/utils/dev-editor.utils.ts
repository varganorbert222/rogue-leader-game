import {
  BabylonHost,
  cloneHierarchyOutlinerState,
  type HierarchyNode,
  type HierarchyNodeTransformInfo,
  type HierarchyOutlinerState,
  type LodEditorModelEntry,
  type LodEditorModelVariant,
  resolveModelVariantPath,
} from '@rogue-leader/engine/dev';
import type { ChangeDetectorRef } from '@angular/core';
import type { Camera } from '@babylonjs/core';
import { startDevPreviewRenderLoop as engineStartDevPreviewRenderLoop } from '@rogue-leader/engine/dev';

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function color4ToHex(color: { r: number; g: number; b: number }): string {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return { r: 1, g: 1, b: 1 };
  }
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

export function hdrVec3ToPicker(color: { x: number; y: number; z: number }): {
  hex: string;
  intensity: number;
} {
  const intensity = Math.max(color.x, color.y, color.z);
  if (intensity <= 0) {
    return { hex: '#ffffff', intensity: 0 };
  }
  return {
    hex: color4ToHex({
      r: color.x / intensity,
      g: color.y / intensity,
      b: color.z / intensity,
    }),
    intensity,
  };
}

export function pickerToHdrVec3(hex: string, intensity: number): { x: number; y: number; z: number } {
  const { r, g, b } = hexToRgb(hex);
  const scale = Math.max(0, intensity);
  return { x: r * scale, y: g * scale, z: b * scale };
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0');
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
  listAnimations?(): import('@rogue-leader/engine/dev').DevPreviewAnimationInfo[];
  getPlayingAnimationIndex?(): number | null;
  playAnimation?(index: number): void;
  stopAnimations?(): void;
  highlightNode?(sceneName: string | undefined): import('@rogue-leader/engine/dev').HierarchyNodeTransformInfo | null;
  clearHighlight?(): void;
  setTransformEditable?(editable: boolean): void;
  onTransformGizmoChange?(handler: (info: import('@rogue-leader/engine/dev').HierarchyNodeTransformInfo) => void): void;
  setTransformGizmoMode?(mode: import('@rogue-leader/engine/dev').DevTransformGizmoMode): void;
  updateSelectedNodeTransform?(
    transform: import('@rogue-leader/engine/dev').DevNodeTransform,
  ): import('@rogue-leader/engine/dev').HierarchyNodeTransformInfo | null;
}

export interface DevSceneHierarchyView {
  hierarchy: HierarchyNode[];
  hierarchyRevision: number;
  selectedNodeId: string;
}

export function beginSceneHierarchyLoad(
  view: DevSceneHierarchyView & {
    nodeTransform?: HierarchyNodeTransformInfo | null;
    selectionTransform?: import('@rogue-leader/engine/dev').DevNodeTransform | null;
    transformGizmoMode?: import('@rogue-leader/engine/dev').DevTransformGizmoMode;
  },
  preview?: DevSceneHierarchyPreview,
): void {
  view.selectedNodeId = '';
  view.hierarchy = [];
  view.hierarchyRevision += 1;
  if ('nodeTransform' in view) {
    view.nodeTransform = null;
  }
  if ('selectionTransform' in view) {
    view.selectionTransform = null;
  }
  if ('transformGizmoMode' in view) {
    view.transformGizmoMode = 'none';
    preview?.setTransformGizmoMode?.('none');
  }
  preview?.clearHighlight?.();
}

export function commitSceneHierarchyLoad(
  view: DevSceneHierarchyView & {
    animations?: import('@rogue-leader/engine/dev').DevPreviewAnimationInfo[];
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
    animations: import('@rogue-leader/engine/dev').DevPreviewAnimationInfo[];
    playingAnimationIndex: number | null;
  },
): void {
  state.animations = preview.listAnimations?.() ?? [];
  state.playingAnimationIndex = preview.getPlayingAnimationIndex?.() ?? null;
}

export function hierarchySceneName(node: HierarchyNode): string | undefined {
  return node.sceneName ?? node.label;
}

export function markViewForCheck(cdr?: ChangeDetectorRef): void {
  cdr?.markForCheck();
}

export async function copyJsonToClipboard(data: unknown): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available in this browser.');
  }
  await navigator.clipboard.writeText(text);
}
