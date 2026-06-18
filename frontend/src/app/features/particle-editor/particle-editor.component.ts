import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BabylonHost,
  buildClonedPresetTree,
  buildReferencedPresetTree,
  buildParticleEffectHierarchy,
  cloneParticleEffect,
  cloneSlotAsInstance,
  cloneTreeNodeSubtree,
  countParticleModules,
  copyNodeTransform,
  createInlineSlot,
  createModuleTreeNode,
  defaultParticleSystem,
  DevConfigTools,
  ensureTreeNodeTransform,
  estimateEffectPreviewDurationMs,
  findSlotById,
  findTreeNode,
  insertNodeUnderAnchor,
  isSlotEditRef,
  isSlotReadonlyRef,
  loadParticlePresets,
  loadParticleTextureCatalog,
  moveTreeNode,
  newBlankParticlePreset,
  ParticlePreviewScene,
  remapTreeIds,
  removeTreeNode,
  resolveParticleSystemSlot,
  serializeParticlePreset,
  setSlotRefMode,
  syncAlbedoTextureFromCatalog,
  syncEffectSystemsFromTree,
  syncStaticAtlasCell,
  isAnimatedParticleAtlas,
  walkTree,
  writeEditRefToCatalog,
  type HierarchyNode,
  type HierarchyReorderEvent,
  type ParticleEffectEditable,
  type ParticleEffectTreeNode,
  type ParticlePresetEntry,
  type ParticlePresetRefMode,
  type ParticleSystemEditable,
  type ParticleSystemSlot,
  type ParticleTextureEntry,
  type DevTransformGizmoMode,
} from '@rogue-leader/engine';
import { DevConfirmModalComponent } from '../../shared/components/dev-confirm-modal/dev-confirm-modal.component';
import { HierarchyPanelComponent } from '../../shared/components/hierarchy-panel/hierarchy-panel.component';
import type { HierarchyContextAction } from '../../shared/components/hierarchy-panel/hierarchy-panel.component';
import { DevEditorShellComponent } from '../../shared/dev-editor/dev-editor-shell.component';
import { DevJsonCopyComponent } from '../../shared/dev-editor/dev-json-copy.component';
import { DevEditorStatusComponent } from '../../shared/dev-editor/dev-editor-status.component';
import { DevTransformInspectorComponent } from '../../shared/dev-editor/inspectors/dev-transform-inspector.component';
import { DevInspectorSectionComponent } from '../../shared/dev-editor/inspectors/dev-inspector-section.component';
import {
  createDevBabylonHost,
  disposeDevBabylonHost,
  startDevPreviewRenderLoop,
  toErrorMessage,
  type DevEditorCanvases,
} from '../../shared/dev-editor/dev-editor.utils';
import {
  ParticleCatalogModalComponent,
  type ParticleCatalogInsertMode,
  type ParticleCatalogInsertResult,
} from './particle-catalog-modal.component';
import { ParticleSystemInspectorComponent } from './inspectors/particle-system-inspector.component';

@Component({
  selector: 'app-particle-editor',
  standalone: true,
  imports: [
    FormsModule,
    HierarchyPanelComponent,
    DevEditorShellComponent,
    DevJsonCopyComponent,
    DevEditorStatusComponent,
    DevTransformInspectorComponent,
    DevInspectorSectionComponent,
    ParticleSystemInspectorComponent,
    ParticleCatalogModalComponent,
    DevConfirmModalComponent,
  ],
  templateUrl: './particle-editor.component.html',
  styleUrl: './particle-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleEditorComponent implements OnInit, OnDestroy {
  readonly devTool = DevConfigTools.particleEditor;

  presets: ParticlePresetEntry[] = [];
  selectedPresetId = '';
  effect: ParticleEffectEditable | null = null;
  selectedNodeId = '';
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  loading = true;
  errorMessage = '';
  playing = false;
  particleTextures: ParticleTextureEntry[] = [];

  catalogModalOpen = false;
  catalogAnchor: HierarchyNode | null = null;
  catalogInitialMode: ParticleCatalogInsertMode = 'blank';
  catalogAllowBlank = true;
  deleteModalOpen = false;
  deleteModalMessage = '';
  deleteModalDetail = '';
  transformGizmoMode: DevTransformGizmoMode = 'none';
  previewReady = false;

  private treeClipboard: ParticleEffectTreeNode | null = null;

  private host: BabylonHost | null = null;
  private preview: ParticlePreviewScene | null = null;
  private updateTimer: number | null = null;
  private resolvedSystemCache: ParticleSystemEditable | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.particleTextures = await loadParticleTextureCatalog();
      this.presets = await loadParticlePresets();
      if (!this.presets.length) {
        this.presets = [newBlankParticlePreset()];
      }
      this.selectedPresetId = this.presets[0].id;
      if (this.previewReady) {
        await this.loadPreset(this.selectedPresetId);
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
      this.loading = false;
    }
  }

  async onCanvasReady(canvases: DevEditorCanvases): Promise<void> {
    try {
      this.host = await createDevBabylonHost(canvases.preview);
      this.preview = new ParticlePreviewScene(this.host);
      await this.preview.initRendering();
      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
      });
      this.previewReady = true;
      this.preview.onTransformGizmoChange((transform) => {
        if (!this.effect || !this.selectedNodeId) return;
        const located = findTreeNode(this.effect.tree, this.selectedNodeId);
        if (!located) return;
        const nodeTransform = ensureTreeNodeTransform(located.node);
        copyNodeTransform(nodeTransform, transform);
        this.syncCurrentPreset({ rebuildSystems: false });
      });
      await this.loadPreset(this.selectedPresetId);
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.updateTimer != null) {
      window.clearTimeout(this.updateTimer);
    }
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  get selectedTreeNode(): ParticleEffectTreeNode | null {
    if (!this.effect || !this.selectedNodeId) return null;
    if (this.selectedNodeId === this.effect.id) return null;
    const located = findTreeNode(this.effect.tree, this.selectedNodeId);
    if (!located) return null;
    ensureTreeNodeTransform(located.node);
    return located.node;
  }

  get selectedSlot(): ParticleSystemSlot | null {
    if (!this.effect || !this.selectedNodeId) return null;
    return findSlotById(this.effect, this.selectedNodeId);
  }

  get selectedGroupNode(): ParticleEffectTreeNode | null {
    const node = this.selectedTreeNode;
    return node?.kind === 'group' ? node : null;
  }

  get selectedSystem(): ParticleSystemEditable | null {
    return this.resolvedSystemCache;
  }

  get selectedSystemReadonly(): boolean {
    const slot = this.selectedSlot;
    return slot ? isSlotReadonlyRef(slot) : false;
  }

  get selectedRefLabel(): string {
    const slot = this.selectedSlot;
    if (!slot?.presetRef) return '';
    const preset = this.presets.find((p) => p.id === slot.presetRef!.presetId);
    let sourceName = slot.presetRef.systemId;
    if (preset) {
      walkTree(preset.effect.tree, (node) => {
        if (node.kind === 'particleSystem' && node.id === slot.presetRef!.systemId) {
          sourceName = node.slot?.name ?? node.name;
        }
      });
    }
    return `${preset?.label ?? slot.presetRef.presetId} → ${sourceName}`;
  }

  get savePayload(): { presets: ParticlePresetEntry[] } {
    return { presets: this.presets.map(serializeParticlePreset) };
  }

  readonly syncBeforeExport = (): void => {
    this.syncCurrentPreset();
  };

  get siblingModuleOptions(): { id: string; name: string }[] {
    const currentId = this.selectedSystem?.id;
    if (!this.effect || !currentId) return [];
    return this.effect.systems
      .filter((slot) => slot.id !== currentId)
      .map((slot) => ({ id: slot.id, name: slot.name }));
  }

  get catalogAnchorLabel(): string {
    return this.catalogAnchor?.label ?? '';
  }

  get treeClipboardReady(): boolean {
    return this.treeClipboard !== null;
  }

  canCopyHierarchyNode = (node: HierarchyNode): boolean => {
    return node.kind !== 'effectRoot';
  };

  canCutHierarchyNode = (node: HierarchyNode): boolean => {
    return this.canCopyHierarchyNode(node) && this.canRemoveHierarchyNode(node);
  };

  canPasteIntoHierarchyNode = (node: HierarchyNode): boolean => {
    return this.treeClipboard !== null && !!this.effect;
  };

  canRemoveHierarchyNode = (node: HierarchyNode): boolean => {
    if (!this.effect) return false;
    if (node.kind === 'effectRoot') return false;
    if (node.kind === 'particleSystem') {
      return countParticleModules(this.effect.tree) > 1;
    }
    return true;
  };

  async onPresetChange(presetId: string): Promise<void> {
    this.syncCurrentPreset();
    this.selectedPresetId = presetId;
    await this.loadPreset(presetId);
  }

  async newPreset(): Promise<void> {
    this.syncCurrentPreset();
    const preset = newBlankParticlePreset();
    this.presets = [...this.presets, preset];
    this.selectedPresetId = preset.id;
    await this.loadPreset(preset.id);
  }

  async duplicatePreset(): Promise<void> {
    if (!this.effect) return;
    this.syncCurrentPreset();

    const copy = cloneParticleEffect(this.effect);
    copy.id = `effect_${Date.now()}`;
    copy.name = `${copy.name} Copy`;
    remapTreeIds(copy.tree);

    const preset: ParticlePresetEntry = {
      id: copy.id,
      label: copy.name,
      effect: copy,
    };

    this.presets = [...this.presets, preset];
    this.selectedPresetId = preset.id;
    await this.loadPreset(preset.id);
  }

  deletePreset(): void {
    if (this.presets.length <= 1) return;

    const preset = this.presets.find((entry) => entry.id === this.selectedPresetId);
    if (!preset) return;

    const dependents = this.presetsReferencing(this.selectedPresetId);
    this.deleteModalMessage = `Delete preset "${preset.label}"?`;
    this.deleteModalDetail = dependents.length
      ? `Other presets reference it: ${dependents.map((entry) => entry.label).join(', ')}. Those links will break.`
      : '';
    this.deleteModalOpen = true;
  }

  onDeleteModalCancel(): void {
    this.deleteModalOpen = false;
    this.deleteModalMessage = '';
    this.deleteModalDetail = '';
  }

  async onDeleteModalConfirm(): Promise<void> {
    this.deleteModalOpen = false;
    this.deleteModalMessage = '';
    this.deleteModalDetail = '';

    this.syncCurrentPreset();
    const index = this.presets.findIndex((entry) => entry.id === this.selectedPresetId);
    if (index < 0) return;

    this.presets = this.presets.filter((entry) => entry.id !== this.selectedPresetId);
    const nextIndex = Math.min(index, this.presets.length - 1);
    this.selectedPresetId = this.presets[nextIndex]?.id ?? '';
    await this.loadPreset(this.selectedPresetId);
  }

  onHierarchySelect(node: HierarchyNode): void {
    this.selectedNodeId = node.id;
    this.preview?.setSelectedNodeId(node.id);
    if (node.kind === 'particleSystem') {
      this.refreshResolvedSystem();
    } else {
      this.resolvedSystemCache = null;
    }
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.transformGizmoMode = mode;
    this.preview?.setTransformGizmoMode(mode);
  }

  onHierarchyReorder(event: HierarchyReorderEvent): void {
    if (!this.effect) return;
    const tree = this.effect.tree;

    if (event.targetId === this.effect.id) {
      const located = findTreeNodeForMove(tree, event.sourceId);
      if (!located) return;
      const [moved] = located.parentChildren.splice(located.index, 1);
      if (event.position === 'before') {
        tree.unshift(moved);
      } else {
        tree.push(moved);
      }
    } else {
      moveTreeNode(tree, event);
    }

    syncEffectSystemsFromTree(this.effect);
    void this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  onAddBelow(node: HierarchyNode): void {
    this.catalogAnchor = node;
    this.catalogInitialMode = 'blank';
    this.catalogAllowBlank = true;
    this.catalogModalOpen = true;
  }

  onHierarchyContextAction(event: { action: HierarchyContextAction; node: HierarchyNode }): void {
    if (!this.effect || !this.previewReady) return;

    if (event.action === 'addCatalog') {
      this.catalogAnchor = event.node;
      this.catalogInitialMode = 'reference-readonly';
      this.catalogAllowBlank = false;
      this.catalogModalOpen = true;
      return;
    }

    if (event.action === 'addBlank') {
      void this.insertModuleUnder(event.node);
      return;
    }

    if (event.action === 'copy') {
      this.copyHierarchyNode(event.node);
      return;
    }

    if (event.action === 'cut') {
      void this.cutHierarchyNode(event.node);
      return;
    }

    if (event.action === 'paste') {
      void this.pasteHierarchyNode(event.node);
      return;
    }

    if (event.action === 'delete') {
      void this.onRemoveHierarchyNode(event.node);
    }
  }

  onCatalogModalCancel(): void {
    this.catalogModalOpen = false;
    this.catalogAnchor = null;
  }

  async onCatalogModalConfirm(result: ParticleCatalogInsertResult): Promise<void> {
    const anchor = this.catalogAnchor;
    this.catalogModalOpen = false;
    this.catalogAnchor = null;
    if (!anchor) return;

    if (result.mode === 'blank') {
      await this.insertModuleUnder(anchor);
      return;
    }

    if (!result.presetId) return;

    if (result.mode === 'clone') {
      const nodes = buildClonedPresetTree(result.presetId, this.presets);
      await this.insertPresetTreeUnder(anchor, nodes);
      return;
    }

    const refMode: ParticlePresetRefMode =
      result.mode === 'reference-edit' ? 'edit' : 'readonly';
    const nodes = buildReferencedPresetTree(result.presetId, refMode, this.presets);
    await this.insertPresetTreeUnder(anchor, nodes);
  }

  async onRemoveHierarchyNode(node: HierarchyNode): Promise<void> {
    if (!this.effect || !this.canRemoveHierarchyNode(node)) return;

    removeTreeNode(this.effect.tree, node.id);
    syncEffectSystemsFromTree(this.effect);

    if (this.selectedNodeId === node.id) {
      this.selectedNodeId = this.firstModuleNodeId();
    }

    await this.resyncPreview();
    this.refreshHierarchy();
    this.refreshResolvedSystem();
    this.syncCurrentPreset();
  }

  async detachSelectedAsClone(): Promise<void> {
    const slot = this.selectedSlot;
    if (!slot || !this.effect || !this.preview) return;

    const detached = cloneSlotAsInstance(slot, this.presets);
    if (!detached) return;

    walkTree(this.effect.tree, (node) => {
      if (node.kind === 'particleSystem' && node.slot?.id === slot.id) {
        node.slot = detached;
        node.name = detached.name;
      }
    });
    syncEffectSystemsFromTree(this.effect);
    this.selectedNodeId = detached.id;
    await this.resyncPreview();
    this.refreshHierarchy();
    this.refreshResolvedSystem();
    this.syncCurrentPreset();
  }

  setSelectedRefMode(mode: ParticlePresetRefMode): void {
    const slot = this.selectedSlot;
    if (!slot?.presetRef) return;
    setSlotRefMode(slot, mode);
    this.refreshHierarchy();
    this.refreshResolvedSystem();
    this.syncCurrentPreset();
  }

  onTransformChange(): void {
    if (!this.effect || !this.selectedNodeId || !this.preview) return;
    const located = findTreeNode(this.effect.tree, this.selectedNodeId);
    if (!located) return;
    const transform = ensureTreeNodeTransform(located.node);
    this.preview.updateNodeTransform(located.node.id, transform);
    this.syncCurrentPreset({ rebuildSystems: false });
  }

  onAlbedoTextureChange(): void {
    const system = this.selectedSystem;
    if (!system || this.selectedSystemReadonly) return;

    if (!system.albedoTexture.textureId) {
      system.albedoTexture.isAtlas = false;
    } else {
      system.albedoTexture = syncStaticAtlasCell(
        syncAlbedoTextureFromCatalog(system.albedoTexture),
      );
    }

    this.onSystemFieldChange();
  }

  onEmissionModeChange(): void {
    this.onSystemFieldChange();
  }

  onDurationChange(): void {
    const system = this.selectedSystem;
    if (!system || this.selectedSystemReadonly) return;
    if (system.looping && system.duration <= 0 && system.emissionMode === 'rate') {
      system.looping = false;
    }
    this.onSystemFieldChange();
  }

  onLoopingChange(): void {
    const system = this.selectedSystem;
    if (!system || this.selectedSystemReadonly) return;
    if (system.looping && system.duration <= 0) {
      system.duration = Math.max(system.maxLifeTime, 1);
    }
    this.onSystemFieldChange();
  }

  onSystemFieldChange(): void {
    const slot = this.selectedSlot;
    const system = this.selectedSystem;
    if (!slot || !system || !this.preview || this.selectedSystemReadonly) return;

    if (!isAnimatedParticleAtlas(system.albedoTexture)) {
      system.albedoTexture = syncStaticAtlasCell(system.albedoTexture);
    }

    if (isSlotEditRef(slot)) {
      writeEditRefToCatalog(slot, system, this.presets);
      this.presets = [...this.presets];
      if (this.effect && this.preview) {
        void this.resyncPreview();
        this.refreshResolvedSystem();
      }
    } else if (!slot.presetRef) {
      slot.config = { ...system, id: slot.id, name: slot.name };
      walkTree(this.effect!.tree, (node) => {
        if (node.kind === 'particleSystem' && node.slot?.id === slot.id) {
          node.name = slot.name;
        }
      });
    }

    syncEffectSystemsFromTree(this.effect!);
    this.refreshHierarchy();
    if (system.renderMode === 'mesh' || system.subEmitters.length > 0) {
      void this.resyncPreview();
    } else {
      this.schedulePreviewUpdate(system);
    }
    this.syncCurrentPreset();
  }

  onSlotNameChange(): void {
    const slot = this.selectedSlot;
    if (!slot || this.selectedSystemReadonly) return;
    if (this.resolvedSystemCache) {
      this.resolvedSystemCache.name = slot.name;
    }
    walkTree(this.effect!.tree, (node) => {
      if (node.kind === 'particleSystem' && node.slot?.id === slot.id) {
        node.name = slot.name;
      }
    });
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  onGroupNameChange(): void {
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  playPreview(): void {
    this.playing = true;
    this.preview?.playAll();
    const durationMs = this.effect
      ? estimateEffectPreviewDurationMs(this.effect, this.presets)
      : 2000;
    window.setTimeout(() => {
      this.playing = false;
    }, durationMs);
  }

  playSelectedSystem(): void {
    if (!this.selectedNodeId || !this.preview) return;
    this.preview.stopAll();
    this.preview.playSystem(this.selectedNodeId);
  }

  stopPreview(): void {
    this.playing = false;
    this.preview?.stopAll();
  }

  private copyHierarchyNode(node: HierarchyNode): void {
    if (!this.effect || !this.canCopyHierarchyNode(node)) return;

    const located = findTreeNode(this.effect.tree, node.id);
    if (!located) return;

    this.treeClipboard = cloneTreeNodeSubtree(located.node);
  }

  private async cutHierarchyNode(node: HierarchyNode): Promise<void> {
    if (!this.canCutHierarchyNode(node)) return;
    this.copyHierarchyNode(node);
    await this.onRemoveHierarchyNode(node);
  }

  private async pasteHierarchyNode(target: HierarchyNode): Promise<void> {
    if (!this.effect || !this.treeClipboard || !this.canPasteIntoHierarchyNode(target)) return;

    const pasted = cloneTreeNodeSubtree(this.treeClipboard);
    await this.insertTreeNodeUnder(target, pasted);
  }

  private async insertPresetTreeUnder(
    anchor: HierarchyNode,
    nodes: ParticleEffectTreeNode[],
  ): Promise<void> {
    if (!this.effect || !this.previewReady || !nodes.length) return;

    for (const node of nodes) {
      insertNodeUnderAnchor(this.effect, anchor.id, anchor.kind, node);
    }
    syncEffectSystemsFromTree(this.effect);

    this.selectedNodeId = this.firstParticleNodeIdInNodes(nodes);
    this.refreshResolvedSystem();

    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  private firstParticleNodeIdInNodes(nodes: readonly ParticleEffectTreeNode[]): string {
    for (const node of nodes) {
      if (node.kind === 'particleSystem') return node.id;
      const nested = this.firstParticleNodeIdInNodes(node.children);
      if (nested) return nested;
    }
    return nodes[0]?.id ?? '';
  }

  private async insertModuleUnder(
    anchor: HierarchyNode,
  ): Promise<void> {
    const slot = createInlineSlot(
      defaultParticleSystem(`System ${countParticleModules(this.effect!.tree) + 1}`),
    );
    await this.insertTreeNodeUnder(anchor, createModuleTreeNode(slot));
  }

  private async insertTreeNodeUnder(
    anchor: HierarchyNode,
    node: ParticleEffectTreeNode,
  ): Promise<void> {
    if (!this.effect || !this.previewReady) return;

    insertNodeUnderAnchor(this.effect, anchor.id, anchor.kind, node);
    syncEffectSystemsFromTree(this.effect);

    this.selectedNodeId = node.id;
    if (node.kind === 'particleSystem') {
      this.refreshResolvedSystem();
    } else {
      this.resolvedSystemCache = null;
    }

    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  private async loadPreset(presetId: string): Promise<void> {
    const preset = this.presets.find((p) => p.id === presetId);
    if (!preset || !this.preview) return;

    this.treeClipboard = null;
    this.effect = cloneParticleEffect(preset.effect);
    syncEffectSystemsFromTree(this.effect);
    await this.preview.setEffect(this.effect, this.presets);
    this.selectedNodeId = this.firstModuleNodeId();
    this.preview.setSelectedNodeId(this.selectedNodeId);
    this.refreshHierarchy();
    this.refreshResolvedSystem();
  }

  onEffectNameChange(): void {
    this.refreshHierarchy();
    this.syncCurrentPreset();
  }

  private syncCurrentPreset(options: { rebuildSystems?: boolean } = {}): void {
    if (!this.effect) return;
    const index = this.presets.findIndex((preset) => preset.id === this.selectedPresetId);
    if (index < 0) return;

    if (options.rebuildSystems !== false) {
      syncEffectSystemsFromTree(this.effect);
    }
    const current = this.presets[index];
    this.presets[index] = {
      ...current,
      label: this.effect.name,
      effect: cloneParticleEffect(this.effect),
    };
    this.presets = [...this.presets];
  }

  private async resyncPreview(): Promise<void> {
    if (!this.effect || !this.preview) return;
    syncEffectSystemsFromTree(this.effect);
    await this.preview.setEffect(this.effect, this.presets);
    this.preview.setSelectedNodeId(this.selectedNodeId);
  }

  private presetsReferencing(presetId: string): ParticlePresetEntry[] {
    return this.presets.filter((entry) => {
      if (entry.id === presetId) return false;
      let references = false;
      walkTree(entry.effect.tree, (node) => {
        if (node.kind === 'particleSystem' && node.slot?.presetRef?.presetId === presetId) {
          references = true;
        }
      });
      return references;
    });
  }

  private refreshResolvedSystem(): void {
    const slot = this.selectedSlot;
    if (!slot) {
      this.resolvedSystemCache = null;
      return;
    }
    this.resolvedSystemCache = resolveParticleSystemSlot(slot, this.presets);
  }

  private refreshHierarchy(): void {
    if (!this.effect) {
      this.hierarchy = [];
      this.hierarchyRevision += 1;
      return;
    }
    this.hierarchy = buildParticleEffectHierarchy(this.effect);
    this.hierarchyRevision += 1;
  }

  private firstModuleNodeId(): string {
    if (!this.effect) return '';
    let id = '';
    walkTree(this.effect.tree, (node) => {
      if (!id && node.kind === 'particleSystem') {
        id = node.id;
      }
    });
    return id;
  }

  private schedulePreviewUpdate(system: ParticleSystemEditable): void {
    if (this.updateTimer != null) {
      window.clearTimeout(this.updateTimer);
    }
    this.updateTimer = window.setTimeout(() => {
      this.preview?.updateSystem(system);
    }, 120);
  }
}

function findTreeNodeForMove(
  tree: ParticleEffectTreeNode[],
  nodeId: string,
): { parentChildren: ParticleEffectTreeNode[]; index: number } | null {
  const topIndex = tree.findIndex((node) => node.id === nodeId);
  if (topIndex >= 0) {
    return { parentChildren: tree, index: topIndex };
  }

  let found: { parentChildren: ParticleEffectTreeNode[]; index: number } | null = null;
  walkTree(tree, (node) => {
    if (found) return;
    const childIndex = node.children.findIndex((child) => child.id === nodeId);
    if (childIndex >= 0) {
      found = { parentChildren: node.children, index: childIndex };
    }
  });
  return found;
}
