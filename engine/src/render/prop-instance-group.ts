import { TransformNode, type Scene } from '@babylonjs/core';
import type { PropManifestEntry } from '../loaders/asset-manifest';
import type { LoadedEntity } from '../loaders/gltf-ship-loader';
import {
  preparePropInstanceTemplate,
  spawnPropInstancesFromTemplate,
} from '../loaders/prop-instance-spawn';

/**
 * One batched instance group per prop/asteroid variant.
 * All live instances share the same hidden source meshes → 1 draw call per source submesh.
 */
export class PropInstanceGroup {
  readonly groupRoot: TransformNode;
  readonly template: LoadedEntity;
  private readonly entry: PropManifestEntry;
  private readonly entries = new Map<string, LoadedEntity>();

  private constructor(
    scene: Scene,
    groupName: string,
    template: LoadedEntity,
    entry: PropManifestEntry,
  ) {
    this.template = template;
    this.entry = entry;
    this.groupRoot = new TransformNode(groupName, scene);
    preparePropInstanceTemplate(template);
  }

  static create(
    scene: Scene,
    groupName: string,
    template: LoadedEntity,
    entry: PropManifestEntry,
  ): PropInstanceGroup {
    return new PropInstanceGroup(scene, groupName, template, entry);
  }

  get instanceCount(): number {
    return this.entries.size;
  }

  /** Add one live instance to this variant group. */
  spawn(instanceId: string): LoadedEntity {
    const existing = this.entries.get(instanceId);
    if (existing) return existing;

    const loaded = spawnPropInstancesFromTemplate(
      this.template,
      instanceId,
      this.entry,
      { groupParent: this.groupRoot },
    );
    this.entries.set(instanceId, loaded);
    return loaded;
  }

  /** Remove one instance without disposing the shared variant template. */
  remove(instanceId: string): boolean {
    const loaded = this.entries.get(instanceId);
    if (!loaded) return false;
    loaded.root.dispose();
    this.entries.delete(instanceId);
    return true;
  }

  has(instanceId: string): boolean {
    return this.entries.has(instanceId);
  }

  dispose(): void {
    for (const loaded of this.entries.values()) {
      if (!loaded.root.isDisposed()) {
        loaded.root.dispose();
      }
    }
    this.entries.clear();
    if (!this.groupRoot.isDisposed()) {
      this.groupRoot.dispose();
    }
  }
}
