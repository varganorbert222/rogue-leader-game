import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BabylonHost,
  buildClonedPrefabTree,
  buildPrefabHierarchy,
  buildReferencedPrefabTree,
  buildReferencedParticlePresetTreeForPrefab,
  canDragPrefabHierarchyNode,
  canInsertUnderPrefabHierarchyNode,
  canRemovePrefabHierarchyNode,
  canReorderPrefabHierarchy,
  clonePrefabEditable,
  clonePrefabTreeNodeSubtree,
  copyNodeTransform,
  createPrefabGroupNode,
  createModelReferenceTree,
  hydratePrefabDisplayHierarchy,
  detachNestedSlotAsClone,
  DevConfigTools,
  ensurePrefabTreeNodeTransform,
  findPrefabSlotById,
  findPrefabTreeNode,
  insertPrefabNodeUnderAnchor,
  insertPrefabNodeAtTreeRoot,
  isPrefabModelSlot,
  isPrefabNestedSlot,
  isPrefabNodeInspectorReadonly,
  isPrefabParticleSlot,
  isSlotEditNestedRef,
  listLodEditorModels,
  loadAssetManifest,
  loadParticlePresets,
  loadParticleTextureCatalog,
  loadPrefabLibrary,
  movePrefabTreeNode,
  newBlankPrefabLibraryEntry,
  PrefabPreviewScene,
  removePrefabTreeNode,
  resolveParticleSystemSlot,
  RuntimePaths,
  serializePrefabLibraryDocument,
  serializePrefabLibraryEntry,
  setNestedRefMode,
  walkPrefabTree,
  walkTree,
  writeEditNestedRefToLibrary,
  type AssetManifest,
  type HierarchyNode,
  type HierarchyReorderEvent,
  type LodEditorModelEntry,
  type ParticlePresetEntry,
  type ParticleSystemEditable,
  type ParticleSystemSlot,
  type ParticleTextureEntry,
  type PrefabContentSlot,
  type PrefabEditable,
  type PrefabLibraryEntry,
  type PrefabTreeNode,
  type DevTransformGizmoMode,
} from '@rogue-leader/engine/dev';
import { DevConfirmModalComponent } from '../../../shared/components/dev-confirm-modal/dev-confirm-modal.component';
import { HierarchyPanelComponent } from '../../../shared/components/hierarchy-panel/hierarchy-panel.component';
import type { HierarchyContextAction } from '../../../shared/components/hierarchy-panel/hierarchy-panel.component';
import { DevEditorShellComponent } from '../../../shared/dev-editor/dev-editor-shell/dev-editor-shell.component';
import { DevJsonCopyComponent } from '../../../shared/dev-editor/dev-json-copy/dev-json-copy.component';
import { DevEditorStatusComponent } from '../../../shared/dev-editor/dev-editor-status/dev-editor-status.component';
import { DevTransformInspectorComponent } from '../../../shared/dev-editor/inspectors/dev-transform-inspector/dev-transform-inspector.component';
import { DevInspectorSectionComponent } from '../../../shared/dev-editor/inspectors/dev-inspector-section/dev-inspector-section.component';
import {
  createDevBabylonHost,
  disposeDevBabylonHost,
  findModelEntry,
  startDevPreviewRenderLoop,
  toErrorMessage,
  type DevEditorCanvases,
} from '../../../shared/dev-editor/utils/dev-editor.utils';
import { ParticleSystemInspectorComponent } from '../../particle-editor/inspectors/particle-system-inspector/particle-system-inspector.component';
import {
  PrefabInsertModalComponent,
  type PrefabInsertMode,
  type PrefabInsertResult,
} from '../modals/prefab-insert-modal/prefab-insert-modal.component';
import { PrefabModelInspectorComponent } from '../inspectors/prefab-model-inspector/prefab-model-inspector.component';

@Component({
  selector: 'app-prefab-manager',
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
    PrefabInsertModalComponent,
    PrefabModelInspectorComponent,
    DevConfirmModalComponent,
  ],
  templateUrl: './prefab-manager.component.html',
  styleUrl: './prefab-manager.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class PrefabManagerComponent implements OnInit, OnDestroy {
  readonly devTool = DevConfigTools.prefabManager;
  readonly isPrefabModelSlot = isPrefabModelSlot;
  readonly isPrefabParticleSlot = isPrefabParticleSlot;
  readonly isPrefabNestedSlot = isPrefabNestedSlot;

  prefabs: PrefabLibraryEntry[] = [];
  selectedPrefabId = '';
  prefab: PrefabEditable | null = null;
  selectedNodeId = '';
  hierarchy: HierarchyNode[] = [];
  hierarchyRevision = 0;
  loading = true;
  errorMessage = '';
  playing = false;
  particlePresets: ParticlePresetEntry[] = [];
  particleTextures: ParticleTextureEntry[] = [];
  models: LodEditorModelEntry[] = [];

  insertModalOpen = false;
  insertAnchor: HierarchyNode | null = null;
  insertAtRoot = false;
  insertInitialMode: PrefabInsertMode = 'model';
  deleteModalOpen = false;
  deleteModalMessage = '';
  deleteModalDetail = '';
  transformGizmoMode: DevTransformGizmoMode = 'none';
  previewReady = false;

  private treeClipboard: PrefabTreeNode | null = null;
  private host: BabylonHost | null = null;
  private preview: PrefabPreviewScene | null = null;
  private manifest: AssetManifest | null = null;
  private resolvedParticleCache: ParticleSystemEditable | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const [library, presets, textures, manifest] = await Promise.all([
        loadPrefabLibrary(),
        loadParticlePresets(),
        loadParticleTextureCatalog(),
        loadAssetManifest(RuntimePaths.assetManifest),
      ]);
      this.manifest = manifest;
      this.models = listLodEditorModels(manifest);
      this.particlePresets = presets;
      this.particleTextures = textures;
      this.prefabs = library.length ? library : [newBlankPrefabLibraryEntry()];
      this.selectedPrefabId = this.prefabs[0].id;
      if (this.previewReady) {
        await this.loadPrefabEntry(this.selectedPrefabId);
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
      this.preview = new PrefabPreviewScene(this.host);
      await this.preview.initRendering();
      startDevPreviewRenderLoop(this.host, {
        updateAxisGizmo: canvases.updateAxisGizmo,
        getCamera: () => this.preview?.getCamera() ?? null,
      });
      this.previewReady = true;
      this.preview.onTransformGizmoChange((transform) => {
        if (!this.prefab || !this.selectedNodeId) return;
        const located = findPrefabTreeNode(this.prefab.tree, this.selectedNodeId);
        if (!located) return;
        const nodeTransform = ensurePrefabTreeNodeTransform(located.node);
        copyNodeTransform(nodeTransform, transform);
        this.syncCurrentPrefab({ rebuildPreview: false });
      });
      await this.loadPrefabEntry(this.selectedPrefabId);
    } catch (err) {
      this.errorMessage = toErrorMessage(err);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    disposeDevBabylonHost(this.host, this.preview);
    this.host = null;
    this.preview = null;
  }

  get selectedTreeNode(): PrefabTreeNode | null {
    if (!this.prefab || !this.selectedNodeId) return null;
    return findPrefabTreeNode(this.prefab.tree, this.selectedNodeId)?.node ?? null;
  }

  get selectedSlot(): PrefabContentSlot | null {
    if (!this.prefab || !this.selectedNodeId) return null;
    return findPrefabSlotById(this.prefab, this.selectedNodeId);
  }

  get selectedGroupNode(): PrefabTreeNode | null {
    const node = this.selectedTreeNode;
    return node?.kind === 'group' ? node : null;
  }

  get selectedSystem(): ParticleSystemEditable | null {
    return this.resolvedParticleCache;
  }

  get selectedParticleSiblingModules(): { id: string; name: string }[] {
    const slot = this.selectedSlot;
    if (!slot || !isPrefabParticleSlot(slot)) return [];
    const preset = this.particlePresets.find((p) => p.id === slot.particleRef.presetId);
    if (!preset) return [];
    const modules: { id: string; name: string }[] = [];
    walkTree(preset.effect.tree, (node) => {
      if (node.kind === 'particleSystem' && node.slot) {
        modules.push({ id: node.id, name: node.slot.name });
      }
    });
    return modules;
  }

  get selectedInspectorReadonly(): boolean {
    const node = this.selectedTreeNode;
    return node ? isPrefabNodeInspectorReadonly(node) : false;
  }

  get selectedNestedRefLabel(): string {
    const slot = this.selectedSlot;
    if (!slot || !isPrefabNestedSlot(slot)) return '';
    const entry = this.prefabs.find((p) => p.id === slot.nestedRef.prefabId);
    return `${entry?.label ?? slot.nestedRef.prefabId} → ${slot.name}`;
  }

  get savePayload(): ReturnType<typeof serializePrefabLibraryDocument> {
    return serializePrefabLibraryDocument(this.prefabs.map(serializePrefabLibraryEntry));
  }

  readonly syncBeforeExport = (): void => {
    this.syncCurrentPrefab();
  };

  get insertAnchorLabel(): string {
    return this.insertAnchor?.label ?? '';
  }

  get treeClipboardReady(): boolean {
    return this.treeClipboard !== null;
  }

  get selectedSceneNode(): PrefabTreeNode | null {
    const node = this.selectedTreeNode;
    return node?.kind === 'sceneNode' ? node : null;
  }

  canCopyHierarchyNode = (node: HierarchyNode): boolean => node.kind !== 'sceneNode';

  canCutHierarchyNode = (node: HierarchyNode): boolean =>
    this.canCopyHierarchyNode(node) && this.canRemoveHierarchyNode(node);

  canPasteIntoHierarchyNode = (node: HierarchyNode): boolean =>
    this.treeClipboard !== null && !!this.prefab && canInsertUnderPrefabHierarchyNode(node);

  canAddBelowHierarchyNode = (node: HierarchyNode): boolean =>
    canInsertUnderPrefabHierarchyNode(node);

  canDragHierarchyNode = (node: HierarchyNode): boolean =>
    canDragPrefabHierarchyNode(node);

  canRemoveHierarchyNode = (node: HierarchyNode): boolean => {
    if (!this.prefab) return false;
    return canRemovePrefabHierarchyNode(this.hierarchy, this.prefab, node);
  };

  async onPrefabChange(prefabId: string): Promise<void> {
    this.syncCurrentPrefab();
    this.selectedPrefabId = prefabId;
    await this.loadPrefabEntry(prefabId);
  }

  async newPrefab(): Promise<void> {
    this.syncCurrentPrefab();
    const entry = newBlankPrefabLibraryEntry();
    this.prefabs = [...this.prefabs, entry];
    this.selectedPrefabId = entry.id;
    await this.loadPrefabEntry(entry.id);
  }

  async duplicatePrefab(): Promise<void> {
    if (!this.prefab) return;
    this.syncCurrentPrefab();
    const copy = clonePrefabEditable(this.prefab);
    copy.id = `prefab_${Date.now()}`;
    copy.name = `${copy.name} Copy`;
    const entry: PrefabLibraryEntry = {
      id: copy.id,
      label: copy.name,
      prefab: copy,
    };
    this.prefabs = [...this.prefabs, entry];
    this.selectedPrefabId = entry.id;
    await this.loadPrefabEntry(entry.id);
  }

  deletePrefab(): void {
    if (this.prefabs.length <= 1) return;
    const entry = this.prefabs.find((item) => item.id === this.selectedPrefabId);
    if (!entry) return;
    const dependents = this.prefabsReferencing(this.selectedPrefabId);
    this.deleteModalMessage = `Delete prefab "${entry.label}"?`;
    this.deleteModalDetail = dependents.length
      ? `Other prefabs reference it: ${dependents.map((p) => p.label).join(', ')}. Those links will break.`
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
    this.syncCurrentPrefab();
    const index = this.prefabs.findIndex((item) => item.id === this.selectedPrefabId);
    if (index < 0) return;
    this.prefabs = this.prefabs.filter((item) => item.id !== this.selectedPrefabId);
    const nextIndex = Math.min(index, this.prefabs.length - 1);
    this.selectedPrefabId = this.prefabs[nextIndex]?.id ?? '';
    await this.loadPrefabEntry(this.selectedPrefabId);
  }

  onHierarchySelect(node: HierarchyNode): void {
    this.selectedNodeId = node.id;
    this.preview?.setSelectedNodeId(node.id);
    this.refreshResolvedParticle();
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.transformGizmoMode = mode;
    this.preview?.setTransformGizmoMode(mode);
  }

  onHierarchyReorder(event: HierarchyReorderEvent): void {
    if (!this.prefab || !canReorderPrefabHierarchy(this.hierarchy, event)) return;
    movePrefabTreeNode(this.prefab.tree, event);

    void this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  onAddBelow(node: HierarchyNode): void {
    if (!canInsertUnderPrefabHierarchyNode(node)) return;
    this.insertAtRoot = false;
    this.insertAnchor = node;
    this.insertInitialMode = 'model';
    this.insertModalOpen = true;
  }

  onAddAtRoot(): void {
    this.insertAtRoot = true;
    this.insertAnchor = null;
    this.insertInitialMode = 'model';
    this.insertModalOpen = true;
  }

  onHierarchyContextAction(event: { action: HierarchyContextAction; node: HierarchyNode }): void {
    if (!this.prefab || !this.previewReady) return;

    if (event.action === 'addCatalog' || event.action === 'addBlank') {
      if (!canInsertUnderPrefabHierarchyNode(event.node)) return;
    }

    if (event.action === 'addCatalog') {
      this.insertAtRoot = false;
      this.insertAnchor = event.node;
      this.insertInitialMode = 'nested-readonly';
      this.insertModalOpen = true;
      return;
    }

    if (event.action === 'addBlank') {
      void this.insertGroupUnder(event.node);
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

  onInsertModalCancel(): void {
    this.insertModalOpen = false;
    this.insertAnchor = null;
    this.insertAtRoot = false;
  }

  async onInsertModalConfirm(result: PrefabInsertResult): Promise<void> {
    const anchor = this.insertAnchor;
    const insertAtRoot = this.insertAtRoot;
    this.insertModalOpen = false;
    this.insertAnchor = null;
    this.insertAtRoot = false;

    if (result.mode === 'group') {
      if (insertAtRoot) {
        await this.insertTreeNodeAtRoot(createPrefabGroupNode());
      } else if (anchor) {
        await this.insertGroupUnder(anchor);
      }
      return;
    }

    if (result.mode === 'model' && result.modelId) {
      const entry = findModelEntry(this.models, result.modelId);
      const label = entry?.label.split(' · ').pop() ?? result.modelId;
      if (!this.host || !this.manifest || !this.previewReady) {
        this.errorMessage = 'Preview is not ready yet — wait for the canvas to load.';
        return;
      }

      this.loading = true;
      try {
        const treeNode = await createModelReferenceTree(
          this.host.scene,
          {
            modelId: result.modelId,
            variantId: result.variantId || undefined,
          },
          this.models,
          this.manifest,
          label,
        );
        if (insertAtRoot) {
          await this.insertTreeNodeAtRoot(treeNode);
        } else if (anchor) {
          await this.insertTreeNodeUnder(anchor, treeNode);
        }
      } catch (err) {
        this.errorMessage = toErrorMessage(err);
      } finally {
        this.loading = false;
      }
      return;
    }

    if (result.mode === 'particle' && result.particlePresetId) {
      const nodes = buildReferencedParticlePresetTreeForPrefab(
        result.particlePresetId,
        this.particlePresets,
      );
      await this.insertPrefabTreeUnder(anchor, nodes, insertAtRoot);
      return;
    }

    if (!result.prefabId) return;

    if (result.mode === 'nested-clone') {
      const nodes = buildClonedPrefabTree(result.prefabId, this.prefabs);
      await this.insertPrefabTreeUnder(anchor, nodes, insertAtRoot);
      return;
    }

    const refMode = result.mode === 'nested-edit' ? 'edit' : 'readonly';
    const nodes = buildReferencedPrefabTree(result.prefabId, refMode, this.prefabs);
    await this.insertPrefabTreeUnder(anchor, nodes, insertAtRoot);
  }

  async onRemoveHierarchyNode(node: HierarchyNode): Promise<void> {
    if (!this.prefab || !this.canRemoveHierarchyNode(node)) return;
    removePrefabTreeNode(this.prefab.tree, node.id);
    if (this.selectedNodeId === node.id) {
      this.selectedNodeId = this.firstContentNodeId();
    }
    await this.resyncPreview();
    this.refreshHierarchy();
    this.refreshResolvedParticle();
    this.syncCurrentPrefab();
  }

  async detachSelectedAsClone(): Promise<void> {
    const slot = this.selectedSlot;
    if (!slot || !isPrefabNestedSlot(slot) || !this.prefab) return;
    const detached = detachNestedSlotAsClone(slot, this.prefabs);
    if (!detached) return;

    walkPrefabTree(this.prefab.tree, (node) => {
      if (node.slot?.id === slot.id) {
        Object.assign(node, detached);
      }
    });
    this.selectedNodeId = detached.id;
    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  setSelectedNestedRefMode(mode: 'readonly' | 'edit'): void {
    const slot = this.selectedSlot;
    if (!slot || !isPrefabNestedSlot(slot)) return;
    setNestedRefMode(slot, mode);
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  onTransformChange(): void {
    if (!this.prefab || !this.selectedNodeId || !this.preview) return;
    const located = findPrefabTreeNode(this.prefab.tree, this.selectedNodeId);
    if (!located) return;
    const transform = ensurePrefabTreeNodeTransform(located.node);
    this.preview.updateNodeTransform(located.node.id, transform);

    if (located.node.slot && isPrefabNestedSlot(located.node.slot) && isSlotEditNestedRef(located.node.slot)) {
      writeEditNestedRefToLibrary(located.node.slot, located.node, this.prefabs);
      this.prefabs = [...this.prefabs];
    }

    this.syncCurrentPrefab({ rebuildPreview: false });
  }

  onGroupNameChange(): void {
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  onPrefabNameChange(): void {
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  onSlotNameChange(): void {
    const slot = this.selectedSlot;
    if (!slot || this.selectedInspectorReadonly) return;
    walkPrefabTree(this.prefab!.tree, (node) => {
      if (node.slot?.id === slot.id) {
        node.name = slot.name;
      }
    });
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  playPreview(): void {
    this.playing = true;
    this.preview?.playAll();
    window.setTimeout(() => {
      this.playing = false;
    }, 2500);
  }

  playSelectedSubtree(): void {
    if (!this.preview || !this.selectedNodeId) return;
    this.playing = true;
    this.preview.stopAll();
    this.preview.playSubtree(this.selectedNodeId);
    window.setTimeout(() => {
      this.playing = false;
    }, 2500);
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
    if (!this.prefab || !this.canCopyHierarchyNode(node)) return;
    const located = findPrefabTreeNode(this.prefab.tree, node.id);
    if (!located) return;
    this.treeClipboard = clonePrefabTreeNodeSubtree(located.node);
  }

  private async cutHierarchyNode(node: HierarchyNode): Promise<void> {
    if (!this.canCutHierarchyNode(node)) return;
    this.copyHierarchyNode(node);
    await this.onRemoveHierarchyNode(node);
  }

  private async pasteHierarchyNode(target: HierarchyNode): Promise<void> {
    if (!this.prefab || !this.treeClipboard || !this.canPasteIntoHierarchyNode(target)) return;
    const pasted = clonePrefabTreeNodeSubtree(this.treeClipboard);
    await this.insertTreeNodeUnder(target, pasted);
  }

  private async insertGroupUnder(anchor: HierarchyNode): Promise<void> {
    await this.insertTreeNodeUnder(anchor, createPrefabGroupNode());
  }

  private async insertPrefabTreeUnder(
    anchor: HierarchyNode | null,
    nodes: PrefabTreeNode[],
    insertAtRoot = false,
  ): Promise<void> {
    if (!this.prefab || !nodes.length) return;
    for (const node of nodes) {
      if (insertAtRoot || !anchor) {
        insertPrefabNodeAtTreeRoot(this.prefab, node);
      } else {
        insertPrefabNodeUnderAnchor(this.prefab, anchor.id, node);
      }
    }
    this.selectedNodeId = this.firstNodeIdInNodes(nodes);
    this.refreshResolvedParticle();
    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  private async insertTreeNodeUnder(
    anchor: HierarchyNode,
    node: PrefabTreeNode,
  ): Promise<void> {
    if (!this.prefab || !canInsertUnderPrefabHierarchyNode(anchor)) return;
    insertPrefabNodeUnderAnchor(this.prefab, anchor.id, node);
    this.selectedNodeId = node.id;
    this.refreshResolvedParticle();
    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  private async insertTreeNodeAtRoot(node: PrefabTreeNode): Promise<void> {
    if (!this.prefab) return;
    insertPrefabNodeAtTreeRoot(this.prefab, node);
    this.selectedNodeId = node.id;
    this.refreshResolvedParticle();
    await this.resyncPreview();
    this.refreshHierarchy();
    this.syncCurrentPrefab();
  }

  private async loadPrefabEntry(prefabId: string): Promise<void> {
    const entry = this.prefabs.find((item) => item.id === prefabId);
    if (!entry || !this.preview || !this.manifest) return;

    this.treeClipboard = null;
    this.prefab = clonePrefabEditable(entry.prefab);
    if (this.host) {
      await hydratePrefabDisplayHierarchy(
        this.host.scene,
        this.prefab,
        this.models,
        this.manifest,
      );
    }
    await this.preview.setPrefab(
      this.prefab,
      this.prefabs,
      this.particlePresets,
      this.models,
      this.manifest,
    );
    this.selectedNodeId = this.firstContentNodeId();
    this.preview.setSelectedNodeId(this.selectedNodeId);
    this.refreshHierarchy();
    this.refreshResolvedParticle();
  }

  private syncCurrentPrefab(options: { rebuildPreview?: boolean } = {}): void {
    if (!this.prefab) return;
    const index = this.prefabs.findIndex((item) => item.id === this.selectedPrefabId);
    if (index < 0) return;

    const current = this.prefabs[index];
    this.prefabs[index] = {
      ...current,
      label: this.prefab.name,
      prefab: clonePrefabEditable(this.prefab),
    };
    this.prefabs = [...this.prefabs];
    if (options.rebuildPreview !== false) {
      void this.resyncPreview();
    }
  }

  private async resyncPreview(): Promise<void> {
    if (!this.prefab || !this.preview || !this.manifest) return;
    await this.preview.setPrefab(
      this.prefab,
      this.prefabs,
      this.particlePresets,
      this.models,
      this.manifest,
    );
    this.preview.setSelectedNodeId(this.selectedNodeId);
  }

  private prefabsReferencing(prefabId: string): PrefabLibraryEntry[] {
    return this.prefabs.filter((entry) => {
      if (entry.id === prefabId) return false;
      let references = false;
      walkPrefabTree(entry.prefab.tree, (node) => {
        if (node.slot && isPrefabNestedSlot(node.slot) && node.slot.nestedRef.prefabId === prefabId) {
          references = true;
        }
      });
      return references;
    });
  }

  private refreshResolvedParticle(): void {
    const slot = this.selectedSlot;
    if (!slot || !isPrefabParticleSlot(slot)) {
      this.resolvedParticleCache = null;
      return;
    }

    const preset = this.particlePresets.find((p) => p.id === slot.particleRef.presetId);
    if (!preset) {
      this.resolvedParticleCache = null;
      return;
    }

    let particleSlot: ParticleSystemSlot | null = null;
    walkTree(preset.effect.tree, (node) => {
      if (node.kind === 'particleSystem' && node.id === slot.particleRef.systemId && node.slot) {
        particleSlot = node.slot;
      }
    });

    this.resolvedParticleCache = particleSlot
      ? resolveParticleSystemSlot(particleSlot, this.particlePresets)
      : null;
  }

  private refreshHierarchy(): void {
    if (!this.prefab) {
      this.hierarchy = [];
    } else {
      this.hierarchy = buildPrefabHierarchy(this.prefab);
    }
    this.hierarchyRevision += 1;
  }

  private firstContentNodeId(): string {
    if (!this.prefab) return '';
    let id = '';
    walkPrefabTree(this.prefab.tree, (node) => {
      if (!id && node.kind !== 'group' && node.kind !== 'sceneNode') id = node.id;
    });
    return id;
  }

  private firstNodeIdInNodes(nodes: readonly PrefabTreeNode[]): string {
    for (const node of nodes) {
      if (node.kind !== 'group') return node.id;
      const nested = this.firstNodeIdInNodes(node.children);
      if (nested) return nested;
    }
    return nodes[0]?.id ?? '';
  }
}
