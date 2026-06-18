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
import { DevTransformGizmo, type DevTransformGizmoMode } from '../dev-transform-gizmo';
import { DebugAxes } from '../../render/debug-axes';
import { DebugFloor } from '../../render/debug-floor';
import { DevPreviewRendering } from '../dev-preview-rendering';
import type { HierarchyNode } from '../hierarchy-types';
import {
  applyEditableToParticleSystem,
  createParticleSystemFromEditable,
} from './apply/factory';
import {
  applySubEmittersToParticleSystem,
  collectSubEmitterTargetIds,
} from './apply/sub-emitters';
import { buildParticleEffectHierarchy } from './hierarchy';
import { MeshParticlePreview } from './mesh/mesh-particle-preview';
import { cloneParticleEffect, normalizeParticleEffect } from './normalize';
import {
  createLocalOriginCross,
  disposeLineMeshes,
} from './origin-cross';
import { resolveParticleSystemSlot } from './refs';
import { startParticlePlayback } from './playback';
import { applyTransformToBabylonNode, type ParticleNodeTransform } from './transform';
import type {
  ParticleEffectEditable,
  ParticleEffectTreeNode,
  ParticlePresetEntry,
  ParticleSystemEditable,
  ParticleSystemSlot,
} from './types';

const EFFECT_ROOT_OFFSET = new Vector3(0, 1.2, 0);
const SELECTION_AXIS_LENGTH = 0.35;

export class ParticlePreviewScene {
  private readonly camera: ArcRotateCamera;
  private readonly floor: DebugFloor;
  private readonly devRendering = new DevPreviewRendering();
  private readonly transformGizmo: DevTransformGizmo;
  private effect: ParticleEffectEditable | null = null;
  private catalog: ParticlePresetEntry[] = [];
  private effectRoot: TransformNode | null = null;
  private transformNodes = new Map<string, TransformNode>();
  private emitterMeshes = new Map<string, AbstractMesh>();
  private systems = new Map<string, ParticleSystem>();
  private subEmitterTemplates = new Map<string, ParticleSystem>();
  private meshPreviews = new Map<string, MeshParticlePreview>();
  private playbackTimers: number[] = [];
  private selectionAxes: DebugAxes | null = null;
  private selectionOriginCross: LinesMesh[] = [];
  private transformChangeHandler: ((transform: ParticleNodeTransform) => void) | null = null;
  private selectedNodeId: string | null = null;

  constructor(private readonly host: BabylonHost) {
    const scene = host.scene;
    const canvas = host.engine.getRenderingCanvas()!;

    this.camera = new ArcRotateCamera(
      'particleEditorCam',
      Math.PI / 4,
      Math.PI / 2.4,
      8,
      EFFECT_ROOT_OFFSET,
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

  getEffect(): ParticleEffectEditable | null {
    return this.effect ? cloneParticleEffect(this.effect) : null;
  }

  getHierarchy(): HierarchyNode[] {
    if (!this.effect) return [];
    return buildParticleEffectHierarchy(this.effect);
  }

  setTransformGizmoMode(mode: DevTransformGizmoMode): void {
    this.transformGizmo.setMode(mode);
    this.refreshTransformGizmoAttachment();
  }

  getTransformGizmoMode(): DevTransformGizmoMode {
    return this.transformGizmo.getMode();
  }

  onTransformGizmoChange(handler: (transform: ParticleNodeTransform) => void): void {
    this.transformChangeHandler = handler;
  }

  async setEffect(
    effect: ParticleEffectEditable,
    catalog: readonly ParticlePresetEntry[],
  ): Promise<void> {
    this.stopAll();
    this.disposeSystems();
    this.catalog = [...catalog];
    this.effect = normalizeParticleEffect(cloneParticleEffect(effect));

    this.effectRoot = new TransformNode('particleEffectRoot', this.host.scene);
    this.effectRoot.position = EFFECT_ROOT_OFFSET.clone();

    await this.buildTreeNodes(this.effect.tree, this.effectRoot);
    this.wireSubEmitters();
    this.refreshSelectionVisuals();
  }

  updateSystem(config: ParticleSystemEditable): void {
    if (!this.effect) return;
    const slot = this.effect.systems.find((s) => s.id === config.id);
    if (!slot) return;

    if (!slot.presetRef) {
      slot.config = { ...config, id: slot.id, name: slot.name };
    }

    const meshPreview = this.meshPreviews.get(config.id);
    if (meshPreview) {
      meshPreview.updateConfig(config);
      return;
    }

    const ps = this.systems.get(config.id);
    if (!ps) return;
    applyEditableToParticleSystem(ps, config, this.host.scene);
    const template = this.subEmitterTemplates.get(config.id);
    if (template) {
      applyEditableToParticleSystem(template, config, this.host.scene);
    }
    this.rewireSubEmittersForParent(config.id);
  }

  updateNodeTransform(nodeId: string, transform: ParticleNodeTransform): void {
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

  reorderSystems(systemIds: string[]): void {
    if (!this.effect) return;
    const byId = new Map(this.effect.systems.map((s) => [s.id, s]));
    this.effect.systems = systemIds
      .map((id) => byId.get(id))
      .filter((s): s is ParticleSystemSlot => !!s);
  }

  registerSystem(slot: ParticleSystemSlot): string | null {
    if (!this.effect) return null;

    const config = resolveParticleSystemSlot(slot, this.catalog);
    if (!config) return slot.id;

    const ps = createParticleSystemFromEditable(this.host.scene, config);
    ps.emitter = EFFECT_ROOT_OFFSET.clone();
    this.systems.set(config.id, ps);
    return slot.id;
  }

  addSystem(slot: ParticleSystemSlot): string | null {
    if (!this.effect) return null;
    this.effect.systems.push(slot);
    return this.registerSystem(slot);
  }

  setCatalog(catalog: readonly ParticlePresetEntry[]): void {
    this.catalog = [...catalog];
  }

  removeSystem(systemId: string): void {
    if (!this.effect) return;
    this.effect.systems = this.effect.systems.filter((s) => s.id !== systemId);
    this.disposeModuleRuntime(systemId);
  }

  playAll(): void {
    this.stopAll();
    if (!this.effect) return;

    const resolved = this.effect.systems
      .map((slot) => resolveParticleSystemSlot(slot, this.catalog))
      .filter((cfg): cfg is ParticleSystemEditable => !!cfg);
    const subOnly = collectSubEmitterTargetIds(resolved);

    for (const [id, ps] of this.systems) {
      if (subOnly.has(id)) continue;
      const slot = this.effect.systems.find((s) => s.id === id);
      if (!slot) continue;
      const config = resolveParticleSystemSlot(slot, this.catalog);
      if (!config) continue;
      startParticlePlayback(ps, config, this.playbackTimers);
    }

    for (const [id, meshPreview] of this.meshPreviews) {
      if (subOnly.has(id)) continue;
      meshPreview.play(this.host.scene);
    }
  }

  playSystem(systemId: string): void {
    if (!this.effect) return;
    const slot = this.effect.systems.find((s) => s.id === systemId);
    if (!slot) return;
    const config = resolveParticleSystemSlot(slot, this.catalog);
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
    this.disposeSystems();
    this.transformGizmo.dispose();
    this.floor.dispose();
    this.devRendering.dispose();
    this.camera.dispose();
  }

  private async buildTreeNodes(
    nodes: ParticleEffectTreeNode[],
    parent: TransformNode,
  ): Promise<void> {
    for (const treeNode of nodes) {
      const transformNode = new TransformNode(`pfx_${treeNode.id}`, this.host.scene);
      transformNode.parent = parent;
      applyTransformToBabylonNode(transformNode, treeNode.transform);
      this.transformNodes.set(treeNode.id, transformNode);

      if (treeNode.kind === 'particleSystem' && treeNode.slot) {
        const config = resolveParticleSystemSlot(treeNode.slot, this.catalog);
        if (config) {
          const emitterMesh = MeshBuilder.CreateBox(
            `pfx_emit_${treeNode.id}`,
            { size: 0.001 },
            this.host.scene,
          );
          emitterMesh.isVisible = false;
          emitterMesh.parent = transformNode;
          this.emitterMeshes.set(treeNode.id, emitterMesh);

          if (config.renderMode === 'mesh' && config.mesh.glbUrl) {
            const meshPreview = await MeshParticlePreview.create(
              this.host.scene,
              emitterMesh,
              config,
            );
            if (meshPreview) {
              this.meshPreviews.set(config.id, meshPreview);
            }
          } else {
            const ps = createParticleSystemFromEditable(this.host.scene, config);
            ps.emitter = emitterMesh;
            this.systems.set(config.id, ps);
          }
        }
      }

      if (treeNode.children.length) {
        await this.buildTreeNodes(treeNode.children, transformNode);
      }
    }
  }

  private wireSubEmitters(): void {
    if (!this.effect) return;

    const resolved = this.effect.systems
      .map((slot) => resolveParticleSystemSlot(slot, this.catalog))
      .filter((cfg): cfg is ParticleSystemEditable => !!cfg);
    const targetIds = collectSubEmitterTargetIds(resolved);

    for (const targetId of targetIds) {
      if (this.subEmitterTemplates.has(targetId)) continue;
      const slot = this.effect.systems.find((s) => s.id === targetId);
      if (!slot) continue;
      const config = resolveParticleSystemSlot(slot, this.catalog);
      if (!config || config.renderMode === 'mesh') continue;

      const emitter = this.emitterMeshes.get(targetId);
      if (!emitter) continue;

      const template = createParticleSystemFromEditable(this.host.scene, config);
      template.emitter = emitter;
      template.stop();
      this.subEmitterTemplates.set(targetId, template);
    }

    for (const slot of this.effect.systems) {
      const config = resolveParticleSystemSlot(slot, this.catalog);
      const parent = this.systems.get(slot.id);
      if (!config || !parent || !config.subEmitters.length) continue;
      applySubEmittersToParticleSystem(parent, config.subEmitters, (targetId) =>
        this.subEmitterTemplates.get(targetId) ?? null,
      );
    }
  }

  private rewireSubEmittersForParent(parentId: string): void {
    if (!this.effect) return;
    const slot = this.effect.systems.find((s) => s.id === parentId);
    const config = slot ? resolveParticleSystemSlot(slot, this.catalog) : null;
    const parent = this.systems.get(parentId);
    if (!config || !parent) return;
    applySubEmittersToParticleSystem(parent, config.subEmitters, (targetId) =>
      this.subEmitterTemplates.get(targetId) ?? null,
    );
  }

  private refreshSelectionVisuals(): void {
    this.clearSelectionVisuals();
    if (!this.selectedNodeId || !this.effect || this.selectedNodeId === this.effect.id) {
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

  private disposeModuleRuntime(systemId: string): void {
    const ps = this.systems.get(systemId);
    if (ps) {
      ps.stop();
      ps.dispose();
      this.systems.delete(systemId);
    }
    const template = this.subEmitterTemplates.get(systemId);
    if (template) {
      template.stop();
      template.dispose();
      this.subEmitterTemplates.delete(systemId);
    }
    const meshPreview = this.meshPreviews.get(systemId);
    if (meshPreview) {
      meshPreview.dispose();
      this.meshPreviews.delete(systemId);
    }
    const transform = this.transformNodes.get(systemId);
    if (transform) {
      transform.dispose();
      this.transformNodes.delete(systemId);
    }
    const emitterMesh = this.emitterMeshes.get(systemId);
    if (emitterMesh) {
      emitterMesh.dispose();
      this.emitterMeshes.delete(systemId);
    }
  }

  private disposeSystems(): void {
    this.clearSelectionVisuals();
    this.transformGizmo.detach();
    for (const ps of this.systems.values()) {
      ps.dispose();
    }
    this.systems.clear();
    for (const template of this.subEmitterTemplates.values()) {
      template.dispose();
    }
    this.subEmitterTemplates.clear();
    for (const meshPreview of this.meshPreviews.values()) {
      meshPreview.dispose();
    }
    this.meshPreviews.clear();
    for (const node of this.transformNodes.values()) {
      node.dispose();
    }
    this.transformNodes.clear();
    for (const mesh of this.emitterMeshes.values()) {
      mesh.dispose();
    }
    this.emitterMeshes.clear();
    this.effectRoot?.dispose();
    this.effectRoot = null;
    this.effect = null;
    this.catalog = [];
  }

  private clearSelectionVisuals(): void {
    this.selectionAxes?.dispose();
    this.selectionAxes = null;
    disposeLineMeshes(this.selectionOriginCross);
    this.selectionOriginCross = [];
  }
}
