import '@babylonjs/loaders/glTF';
import {
  ArcRotateCamera,
  Color4,
  MeshBuilder,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type LinesMesh,
  type ParticleSystem,
} from '@babylonjs/core';
import type { BabylonHost } from '../../core/babylon-host';
import { RuntimePaths } from '../../runtime-paths';
import { collectDescendantMeshes } from '../../loaders/clone-entity-utils';
import { showLoadedEntityForDevPreview } from '../../loaders/loaded-entity-visibility';
import { type AssetManifest } from '../../loaders/asset-manifest';
import type { LodEditorModelEntry } from '../lod-editor-types';
import { DevTransformGizmo, type DevTransformGizmoMode } from '../dev-transform-gizmo';
import { DebugAxes } from '../../render/debug-axes';
import { DebugFloor } from '../../render/debug-floor';
import { DevPreviewRendering } from '../dev-preview-rendering';
import type { HierarchyNode } from '../hierarchy-types';
import {
  applySubEmittersToParticleSystem,
  collectSubEmitterTargetIds,
} from '../particle/apply/sub-emitters';
import { createParticleSystemFromEditable } from '../particle/apply/factory';
import { MeshParticlePreview } from '../particle/mesh/mesh-particle-preview';
import { createLocalOriginCross, disposeLineMeshes } from '../particle/origin-cross';
import { resolveParticleSystemSlot } from '../particle/refs';
import { walkTree } from '../particle/tree';
import { startParticlePlayback, playParticleModuleIds } from '../particle/playback';
import type {
  ParticlePresetEntry,
  ParticleSystemEditable,
  ParticleSystemSlot,
} from '../particle/types';
import { buildPrefabHierarchy } from './hierarchy';
import {
  clonePrefabEditable,
  isPrefabModelSlot,
  isPrefabNestedSlot,
  isPrefabParticleSlot,
  resolveNestedSlotToTreeNode,
} from './refs';
import { applyTransformToBabylonNode } from './transform';
import type { PrefabNodeTransform } from './types';
import { loadManifestModelEntity } from './model-hierarchy';
import { collectPrefabParticleSystemIdsInSubtree, walkPrefabTree } from './tree';
import type {
  PrefabEditable,
  PrefabLibraryEntry,
  PrefabParticleSlot,
  PrefabTreeNode,
} from './types';

const PREFAB_ROOT_OFFSET = new Vector3(0, 1.2, 0);
const SELECTION_AXIS_LENGTH = 0.35;

export class PrefabPreviewScene {
  private readonly camera: ArcRotateCamera;
  private readonly floor: DebugFloor;
  private readonly devRendering = new DevPreviewRendering();
  private readonly transformGizmo: DevTransformGizmo;
  private prefab: PrefabEditable | null = null;
  private library: PrefabLibraryEntry[] = [];
  private particlePresets: ParticlePresetEntry[] = [];
  private models: LodEditorModelEntry[] = [];
  private manifest: AssetManifest | null = null;
  private prefabRoot: TransformNode | null = null;
  private transformNodes = new Map<string, TransformNode>();
  private modelRoots = new Map<string, TransformNode | AbstractMesh>();
  private emitterMeshes = new Map<string, AbstractMesh>();
  private systems = new Map<string, ParticleSystem>();
  private subEmitterTemplates = new Map<string, ParticleSystem>();
  private meshPreviews = new Map<string, MeshParticlePreview>();
  private playbackTimers: number[] = [];
  private selectionAxes: DebugAxes | null = null;
  private selectionOriginCross: LinesMesh[] = [];
  private transformChangeHandler: ((transform: PrefabNodeTransform) => void) | null = null;
  private selectedNodeId: string | null = null;

  constructor(private readonly host: BabylonHost) {
    const scene = host.scene;
    const canvas = host.engine.getRenderingCanvas()!;

    this.camera = new ArcRotateCamera(
      'prefabManagerCam',
      Math.PI / 4,
      Math.PI / 2.4,
      8,
      PREFAB_ROOT_OFFSET,
      scene,
    );
    this.camera.minZ = 0.05;
    this.camera.wheelPrecision = 20;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(canvas, true);
    scene.activeCamera = this.camera;
    scene.clearColor = new Color4(0.11, 0.11, 0.12, 1);

    this.floor = new DebugFloor(scene, {
      center: Vector3.Zero(),
      extent: 24,
      step: 2,
      y: 0,
    });

    this.transformGizmo = new DevTransformGizmo(scene);
  }

  async initRendering(): Promise<void> {
    await this.devRendering.attach(this.host, this.camera);
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  getHierarchy(): HierarchyNode[] {
    if (!this.prefab) return [];
    return buildPrefabHierarchy(this.prefab);
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.transformGizmo.setMode(mode);
    this.refreshTransformGizmoAttachment();
  }

  onTransformGizmoChange(handler: (transform: PrefabNodeTransform) => void): void {
    this.transformChangeHandler = handler;
  }

  async setPrefab(
    prefab: PrefabEditable,
    library: readonly PrefabLibraryEntry[],
    particlePresets: readonly ParticlePresetEntry[],
    models: readonly LodEditorModelEntry[],
    manifest: AssetManifest,
  ): Promise<void> {
    this.stopAll();
    this.disposeContent();
    this.library = [...library];
    this.particlePresets = [...particlePresets];
    this.models = [...models];
    this.manifest = manifest;
    this.prefab = clonePrefabEditable(prefab);

    this.prefabRoot = new TransformNode('prefabRoot', this.host.scene);
    this.prefabRoot.position = PREFAB_ROOT_OFFSET.clone();

    await this.buildTreeNodes(this.prefab.tree, this.prefabRoot);
    this.wireSubEmitters();
    this.refreshSelectionVisuals();
  }

  updateNodeTransform(nodeId: string, transform: PrefabNodeTransform): void {
    const node = this.transformNodes.get(nodeId);
    if (!node) return;
    applyTransformToBabylonNode(node, transform);
    this.refreshSelectionVisuals();
    if (nodeId === this.selectedNodeId) {
      this.refreshTransformGizmoAttachment();
      this.transformGizmo.syncToAttachedNode(transform);
    }
  }

  setSelectedNodeId(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.refreshSelectionVisuals();
    this.refreshTransformGizmoAttachment();
  }

  playAll(): void {
    if (!this.prefab) return;
    this.playSubtree(this.prefab.id);
  }

  playSubtree(anchorNodeId: string): void {
    if (!this.prefab) return;
    this.stopAll();

    const systemIds = collectPrefabParticleSystemIdsInSubtree(this.prefab, anchorNodeId);
    const resolved = this.collectResolvedParticleConfigs();
    const subOnly = collectSubEmitterTargetIds(resolved);

    playParticleModuleIds(systemIds, {
      systems: this.systems,
      meshPreviews: this.meshPreviews,
      resolved,
      subOnly,
      scene: this.host.scene,
      timers: this.playbackTimers,
    });
  }

  playSystem(systemId: string): void {
    const config = this.collectResolvedParticleConfigs().find((c) => c.id === systemId);
    if (!config) return;

    const meshPreview = this.meshPreviews.get(systemId);
    if (meshPreview) {
      meshPreview.play(this.host.scene);
      return;
    }

    const ps = this.systems.get(systemId);
    if (!ps) return;
    startParticlePlayback(ps, config, this.playbackTimers);
  }

  stopAll(): void {
    for (const timer of this.playbackTimers) {
      window.clearTimeout(timer);
    }
    this.playbackTimers = [];
    for (const ps of this.systems.values()) {
      ps.manualEmitCount = -1;
      ps.stop();
    }
    for (const template of this.subEmitterTemplates.values()) {
      template.manualEmitCount = -1;
      template.stop();
    }
    for (const meshPreview of this.meshPreviews.values()) {
      meshPreview.stop();
    }
  }

  dispose(): void {
    this.stopAll();
    this.disposeContent();
    this.transformGizmo.dispose();
    this.floor.dispose();
    this.devRendering.dispose();
    this.camera.dispose();
  }

  private collectResolvedParticleConfigs(): ParticleSystemEditable[] {
    const configs: ParticleSystemEditable[] = [];
    for (const nodeId of new Set([...this.systems.keys(), ...this.meshPreviews.keys()])) {
      const cfg = this.resolveParticleConfigForNodeId(nodeId);
      if (cfg) configs.push(cfg);
    }
    return configs;
  }

  private resolveParticleConfigForNodeId(nodeId: string): ParticleSystemEditable | null {
    if (!this.prefab) return null;
    let particleSlot: PrefabParticleSlot | null = null;
    walkPrefabTree(this.prefab.tree, (node) => {
      if (node.id === nodeId && node.slot && isPrefabParticleSlot(node.slot)) {
        particleSlot = node.slot;
      }
    });
    if (!particleSlot) return null;
    return resolveParticleConfigFromSlot(particleSlot, this.particlePresets, nodeId);
  }

  private async buildTreeNodes(
    nodes: PrefabTreeNode[],
    parent: TransformNode,
  ): Promise<void> {
    for (const treeNode of nodes) {
      if (treeNode.kind === 'sceneNode') {
        continue;
      }

      const resolvedNode = this.resolveTreeNode(treeNode);
      if (!resolvedNode) continue;

      const transformNode = new TransformNode(`pfb_${resolvedNode.id}`, this.host.scene);
      transformNode.parent = parent;
      applyTransformToBabylonNode(transformNode, resolvedNode.transform);
      this.transformNodes.set(resolvedNode.id, transformNode);

      if (resolvedNode.slot) {
        if (isPrefabModelSlot(resolvedNode.slot)) {
          await this.loadModelNode(resolvedNode.id, resolvedNode.slot, transformNode);
        } else if (isPrefabParticleSlot(resolvedNode.slot)) {
          await this.loadParticleNode(resolvedNode.id, resolvedNode.slot, transformNode);
        }
      }

      if (resolvedNode.children.length) {
        await this.buildTreeNodes(resolvedNode.children, transformNode);
      }
    }
  }

  private resolveTreeNode(node: PrefabTreeNode): PrefabTreeNode | null {
    if (node.slot && isPrefabNestedSlot(node.slot)) {
      return resolveNestedSlotToTreeNode(node.slot, this.library);
    }
    return node;
  }

  private async loadModelNode(
    nodeId: string,
    slot: import('./types').PrefabModelSlot,
    parent: TransformNode,
  ): Promise<void> {
    if (!this.manifest) return;

    const entity = await loadManifestModelEntity(
      this.host.scene,
      slot.modelRef,
      this.models,
      this.manifest,
    );

    if (!entity) {
      const box = MeshBuilder.CreateBox(`pfb_mdl_ph_${nodeId}`, { size: 0.5 }, this.host.scene);
      box.parent = parent;
      this.modelRoots.set(nodeId, box);
      return;
    }

    entity.root.parent = parent;
    entity.root.position.set(0, 0, 0);
    entity.root.rotationQuaternion = null;
    entity.root.rotation.set(0, 0, 0);
    showLoadedEntityForDevPreview(entity);
    const previewMeshes = collectDescendantMeshes(entity.root).filter((mesh) => mesh.isVisible);
    this.devRendering.applyEmissiveBloomToMeshes(
      previewMeshes.length > 0 ? previewMeshes : entity.meshes,
    );
    this.modelRoots.set(nodeId, entity.root);
  }

  private async loadParticleNode(
    nodeId: string,
    slot: PrefabParticleSlot,
    parent: TransformNode,
  ): Promise<void> {
    const config = resolveParticleConfigFromSlot(slot, this.particlePresets, nodeId);
    if (!config) return;

    const emitterMesh = MeshBuilder.CreateBox(
      `pfb_emit_${nodeId}`,
      { size: 0.001 },
      this.host.scene,
    );
    emitterMesh.isVisible = false;
    emitterMesh.parent = parent;
    this.emitterMeshes.set(nodeId, emitterMesh);

    if (config.renderMode === 'mesh' && config.mesh.glbUrl) {
      const meshPreview = await MeshParticlePreview.create(
        this.host.scene,
        emitterMesh,
        config,
      );
      if (meshPreview) {
        this.meshPreviews.set(nodeId, meshPreview);
      }
    } else {
      const ps = createParticleSystemFromEditable(this.host.scene, config);
      ps.emitter = emitterMesh;
      this.systems.set(nodeId, ps);
    }
  }

  private wireSubEmitters(): void {
    const resolved = this.collectResolvedParticleConfigs();
    const targetIds = collectSubEmitterTargetIds(resolved);

    for (const targetId of targetIds) {
      if (this.subEmitterTemplates.has(targetId)) continue;
      const config = resolved.find((c) => c.id === targetId);
      if (!config || config.renderMode === 'mesh') continue;

      const emitter = this.emitterMeshes.get(targetId);
      if (!emitter) continue;

      const template = createParticleSystemFromEditable(this.host.scene, config);
      template.emitter = emitter;
      template.stop();
      this.subEmitterTemplates.set(targetId, template);
    }

    for (const config of resolved) {
      const parent = this.systems.get(config.id);
      if (!parent || !config.subEmitters.length) continue;
      applySubEmittersToParticleSystem(parent, config.subEmitters, (targetId) =>
        this.subEmitterTemplates.get(targetId) ?? null,
      );
    }
  }

  private refreshSelectionVisuals(): void {
    this.clearSelectionVisuals();
    if (!this.selectedNodeId || !this.prefab || this.selectedNodeId === this.prefab.id) {
      return;
    }

    const transform = this.transformNodes.get(this.selectedNodeId);
    if (!transform) return;

    this.selectionAxes = DebugAxes.local(this.host.scene, transform, SELECTION_AXIS_LENGTH);
    this.selectionOriginCross = createLocalOriginCross(this.host.scene, transform);
  }

  private refreshTransformGizmoAttachment(): void {
    if (!this.selectedNodeId || !this.transformChangeHandler) {
      this.transformGizmo.detach();
      return;
    }

    const node = this.transformNodes.get(this.selectedNodeId);
    if (!node) {
      this.transformGizmo.detach();
      return;
    }

    this.transformGizmo.attach(node, (transform) => {
      this.transformChangeHandler?.(transform);
      this.refreshSelectionVisuals();
    });
  }

  private disposeContent(): void {
    this.clearSelectionVisuals();
    this.transformGizmo.detach();
    for (const ps of this.systems.values()) ps.dispose();
    this.systems.clear();
    for (const template of this.subEmitterTemplates.values()) template.dispose();
    this.subEmitterTemplates.clear();
    for (const meshPreview of this.meshPreviews.values()) meshPreview.dispose();
    this.meshPreviews.clear();
    for (const root of this.modelRoots.values()) root.dispose();
    this.modelRoots.clear();
    for (const node of this.transformNodes.values()) node.dispose();
    this.transformNodes.clear();
    for (const mesh of this.emitterMeshes.values()) mesh.dispose();
    this.emitterMeshes.clear();
    this.prefabRoot?.dispose();
    this.prefabRoot = null;
    this.prefab = null;
  }

  private clearSelectionVisuals(): void {
    this.selectionAxes?.dispose();
    this.selectionAxes = null;
    disposeLineMeshes(this.selectionOriginCross);
    this.selectionOriginCross = [];
  }
}

function resolveParticleConfigFromSlot(
  slot: PrefabParticleSlot,
  particlePresets: readonly ParticlePresetEntry[],
  nodeId: string,
): ParticleSystemEditable | null {
  const preset = particlePresets.find((p) => p.id === slot.particleRef.presetId);
  if (!preset) return null;

  let particleSlot: ParticleSystemSlot | null = null;
  walkTree(preset.effect.tree, (node) => {
    if (node.kind === 'particleSystem' && node.id === slot.particleRef.systemId && node.slot) {
      particleSlot = node.slot;
    }
  });
  if (!particleSlot) return null;

  const resolved = resolveParticleSystemSlot(particleSlot, particlePresets);
  if (!resolved) return null;
  return { ...resolved, id: nodeId, name: slot.name };
}
