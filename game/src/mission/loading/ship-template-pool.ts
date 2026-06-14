import type { AssetManifest, GltfShipLoader, LoadedEntity } from '@rogue-leader/engine';
import {
  prepareLoadedEntityForAcquire,
  prepareLoadedEntityForPool,
  resetLoadedEntityTransform,
  setLoadedEntityVisible,
} from '@rogue-leader/engine';

const MAX_INSTANCES_PER_SHIP = 256;
const POOL_HIDE_Y = -5000;

export class ShipTemplatePool {
  private readonly templates = new Map<string, LoadedEntity>();
  private readonly instances = new Map<string, LoadedEntity[]>();

  async preload(
    shipIds: readonly string[],
    manifest: AssetManifest,
    loader: GltfShipLoader
  ): Promise<void> {
    await Promise.all(
      shipIds.map(async (shipId) => {
        if (this.templates.has(shipId)) return;
        const entry = manifest.ships[shipId];
        if (!entry) return;
        const loaded = await loader.loadShip(shipId, entry);
        setLoadedEntityVisible(loaded, false);
        this.templates.set(shipId, loaded);
      })
    );
  }

  takePlayerShip(shipId: string): LoadedEntity {
    const template = this.templates.get(shipId);
    if (!template) {
      throw new Error(`Ship template not preloaded: ${shipId}`);
    }
    setLoadedEntityVisible(template, true);
    return template;
  }

  acquireNpcShip(shipId: string, instanceId: string, loader: GltfShipLoader): LoadedEntity {
    const pooled = this.instances.get(shipId);
    const reused = pooled?.pop();
    if (reused && !reused.root.isDisposed()) {
      reused.root.name = `${instanceId}_root`;
      resetLoadedEntityTransform(reused);
      prepareLoadedEntityForAcquire(reused);
      return reused;
    }
    const loaded = this.cloneNpcShip(shipId, instanceId, loader);
    resetLoadedEntityTransform(loaded);
    prepareLoadedEntityForAcquire(loaded);
    return loaded;
  }

  releaseNpcShip(shipId: string, loaded: LoadedEntity): void {
    if (loaded.root.isDisposed()) return;
    prepareLoadedEntityForPool(loaded);
    loaded.root.position.set(0, POOL_HIDE_Y, 0);

    const pool = this.instances.get(shipId) ?? [];
    if (pool.length < MAX_INSTANCES_PER_SHIP) {
      pool.push(loaded);
      this.instances.set(shipId, pool);
      return;
    }
    loaded.root.dispose();
  }

  cloneNpcShip(shipId: string, instanceId: string, loader: GltfShipLoader): LoadedEntity {
    const template = this.templates.get(shipId);
    if (!template) {
      throw new Error(`Ship template not preloaded: ${shipId}`);
    }
    return loader.cloneShip(template, instanceId);
  }

  dispose(): void {
    for (const pool of this.instances.values()) {
      for (const instance of pool) {
        if (!instance.root.isDisposed()) {
          instance.root.dispose();
        }
      }
    }
    this.instances.clear();

    for (const template of this.templates.values()) {
      if (!template.root.isDisposed()) {
        template.root.dispose();
      }
    }
    this.templates.clear();
  }
}
