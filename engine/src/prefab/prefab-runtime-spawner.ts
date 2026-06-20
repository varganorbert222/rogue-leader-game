import {
  MeshBuilder,
  ParticleSystem,
  TransformNode,
  type AbstractMesh,
  type IParticleSystem,
  type Scene,
} from '@babylonjs/core';
import type { AssetManifest } from '../loaders/asset-manifest';
import {
  cloneLoadedEntityRoot,
  remapMeshGroupByName,
} from '../loaders/clone-entity-utils';
import { ensureNodeWorldMatrix } from '../render/mesh-world-utils';
import { createParticleSystemFromEditable } from '../dev/particle/apply/factory';
import {
  applySubEmittersToParticleSystem,
  collectSubEmitterTargetIds,
} from '../dev/particle/apply/sub-emitters';
import { startParticlePlayback } from '../dev/particle/playback';
import { resolveParticleSystemSlot } from '../dev/particle/refs';
import { walkTree } from '../dev/particle/tree';
import type {
  ParticlePresetEntry,
  ParticleSystemEditable,
  ParticleSystemSlot,
} from '../dev/particle/types';
import { applyTransformToBabylonNode } from '../dev/particle/transform';
import type { LodEditorModelEntry } from '../dev/lod-editor-types';
import { loadManifestModelEntity } from '../dev/prefab/model-hierarchy';
import {
  isPrefabModelSlot,
  isPrefabNestedSlot,
  isPrefabParticleSlot,
  resolveNestedSlotToTreeNode,
} from '../dev/prefab/refs';
import type {
  PrefabLibraryEntry,
  PrefabParticleSlot,
  PrefabTreeNode,
} from '../dev/prefab/types';

export interface PrefabWorldKinematics {
  position: import('@babylonjs/core').Vector3;
  rotationQuaternion: import('@babylonjs/core').Quaternion;
  scaling?: import('@babylonjs/core').Vector3;
}

export interface SpawnedPrefabInstance {
  root: TransformNode;
  particleSystems: IParticleSystem[];
  dispose(): void;
}

interface TemplateParticleBinding {
  nodeId: string;
  config: ParticleSystemEditable;
  templateEmitter: AbstractMesh;
  /** Source module id inside the particle preset (`particleRef.systemId`). */
  sourceSystemId: string;
}

function resolveParticleConfigFromSlot(
  slot: PrefabParticleSlot,
  particlePresets: readonly ParticlePresetEntry[],
  nodeId: string,
): ParticleSystemEditable | null {
  const preset = particlePresets.find((item) => item.id === slot.particleRef.presetId);
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

export class PrefabRuntimeSpawner {
  private readonly templates = new Map<string, TransformNode>();
  private readonly particleBindings = new Map<string, TemplateParticleBinding[]>();

  constructor(
    private readonly scene: Scene,
    private readonly library: readonly PrefabLibraryEntry[],
    private readonly models: readonly LodEditorModelEntry[],
    private readonly manifest: AssetManifest,
    private readonly particlePresets: readonly ParticlePresetEntry[],
    private readonly assetsBaseUrl: string,
  ) {}

  hasTemplate(prefabId: string): boolean {
    return this.templates.has(prefabId);
  }

  async preload(prefabIds: readonly string[]): Promise<void> {
    await Promise.all(
      [...new Set(prefabIds)].map((prefabId) => this.ensureTemplate(prefabId)),
    );
  }

  spawn(prefabId: string, kinematics: PrefabWorldKinematics): SpawnedPrefabInstance | null {
    const template = this.templates.get(prefabId);
    if (!template) return null;

    const root = cloneLoadedEntityRoot(template, `death_${prefabId}`);
    root.position.copyFrom(kinematics.position);
    root.rotationQuaternion = kinematics.rotationQuaternion.clone();
    if (kinematics.scaling) {
      root.scaling.copyFrom(kinematics.scaling);
    }
    root.computeWorldMatrix(true);

    const bindings = this.particleBindings.get(prefabId) ?? [];
    const particleSystems: IParticleSystem[] = [];
    const playbackTimers: number[] = [];
    const systemsByNodeId = new Map<string, IParticleSystem>();
    const systemsBySourceId = new Map<string, IParticleSystem>();
    const subEmitterTemplates = new Map<string, ParticleSystem>();

    for (const binding of bindings) {
      const [emitter] = remapMeshGroupByName(
        [binding.templateEmitter],
        template,
        root,
      );
      if (!emitter) continue;

      ensureNodeWorldMatrix(emitter);

      const ps = createParticleSystemFromEditable(this.scene, binding.config);
      ps.emitter = emitter;
      systemsByNodeId.set(binding.nodeId, ps);
      systemsBySourceId.set(binding.sourceSystemId, ps);
      particleSystems.push(ps);
    }

    const resolvedConfigs = bindings.map((binding) => binding.config);
    const subOnly = collectSubEmitterTargetIds(resolvedConfigs);

    for (const targetId of subOnly) {
      const ps = systemsBySourceId.get(targetId) as ParticleSystem | undefined;
      if (!ps) continue;
      ps.stop();
      subEmitterTemplates.set(targetId, ps);
    }

    for (const binding of bindings) {
      if (!binding.config.subEmitters.length) continue;
      const parent = systemsByNodeId.get(binding.nodeId);
      if (!parent) continue;
      applySubEmittersToParticleSystem(
        parent as ParticleSystem,
        binding.config.subEmitters,
        (targetId) =>
          subEmitterTemplates.get(targetId) ??
          (systemsBySourceId.get(targetId) as ParticleSystem | null) ??
          null,
      );
    }

    for (const binding of bindings) {
      if (subOnly.has(binding.sourceSystemId)) continue;
      const ps = systemsByNodeId.get(binding.nodeId);
      if (!ps) continue;
      startParticlePlayback(ps as ParticleSystem, binding.config, playbackTimers);
    }

    return {
      root,
      particleSystems,
      dispose: () => {
        for (const timer of playbackTimers) {
          window.clearTimeout(timer);
        }
        for (const ps of particleSystems) {
          ps.stop();
          ps.dispose();
        }
        root.dispose();
      },
    };
  }

  dispose(): void {
    for (const template of this.templates.values()) {
      template.dispose();
    }
    this.templates.clear();
    this.particleBindings.clear();
  }

  private async ensureTemplate(prefabId: string): Promise<void> {
    if (this.templates.has(prefabId)) return;

    const entry = this.library.find((item) => item.id === prefabId);
    if (!entry) return;

    this.particleBindings.set(prefabId, []);
    const root = new TransformNode(`death_tpl_${prefabId}`, this.scene);
    root.setEnabled(false);
    await this.buildTreeNodes(entry.prefab.tree, root, prefabId);
    this.templates.set(prefabId, root);
  }

  private async buildTreeNodes(
    nodes: readonly PrefabTreeNode[],
    parent: TransformNode,
    prefabId: string,
  ): Promise<void> {
    for (const treeNode of nodes) {
      if (treeNode.kind === 'sceneNode') continue;

      const resolvedNode = this.resolveTreeNode(treeNode);
      if (!resolvedNode) continue;

      const transformNode = new TransformNode(`pfb_${resolvedNode.id}`, this.scene);
      transformNode.parent = parent;
      applyTransformToBabylonNode(transformNode, resolvedNode.transform);

      if (resolvedNode.slot) {
        if (isPrefabModelSlot(resolvedNode.slot)) {
          await this.loadModelNode(resolvedNode.slot, transformNode);
        } else if (isPrefabParticleSlot(resolvedNode.slot)) {
          this.loadParticleNode(resolvedNode.id, resolvedNode.slot, transformNode, prefabId);
        }
      }

      if (resolvedNode.children.length) {
        await this.buildTreeNodes(resolvedNode.children, transformNode, prefabId);
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
    slot: import('../dev/prefab/types').PrefabModelSlot,
    parent: TransformNode,
  ): Promise<void> {
    const entity = await loadManifestModelEntity(
      this.scene,
      slot.modelRef,
      this.models,
      this.manifest,
      this.assetsBaseUrl as '/assets',
    );

    if (!entity) {
      const box = MeshBuilder.CreateBox(`pfb_mdl_ph_${slot.id}`, { size: 0.5 }, this.scene);
      box.parent = parent;
      return;
    }

    entity.root.parent = parent;
    entity.root.position.set(0, 0, 0);
    entity.root.rotationQuaternion = null;
    entity.root.rotation.set(0, 0, 0);
  }

  private loadParticleNode(
    nodeId: string,
    slot: PrefabParticleSlot,
    parent: TransformNode,
    prefabId: string,
  ): void {
    const config = resolveParticleConfigFromSlot(slot, this.particlePresets, nodeId);
    if (!config) return;

    const emitterName = `pfb_emit_${prefabId}_${nodeId}`;
    const emitterMesh = MeshBuilder.CreateBox(emitterName, { size: 0.001 }, this.scene);
    emitterMesh.isVisible = false;
    emitterMesh.parent = parent;

    this.particleBindings.get(prefabId)?.push({
      nodeId,
      config: { ...config, id: nodeId, name: slot.name },
      templateEmitter: emitterMesh,
      sourceSystemId: slot.particleRef.systemId,
    });
  }
}
