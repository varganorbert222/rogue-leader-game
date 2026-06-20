import type { Quaternion, Scene, Vector3 } from '@babylonjs/core';
import {
  listLodEditorModels,
  loadParticlePresets,
  loadRuntimePrefabLibrary,
  PrefabRuntimeSpawner,
  RuntimePaths,
  type AssetManifest,
  type PrefabWorldKinematics,
} from '@rogue-leader/engine';

const DEATH_EFFECT_LIFETIME_SEC = 15;

export interface DeathEffectSpawnKinematics {
  position: Vector3;
  rotationQuaternion: Quaternion;
  velocity?: Vector3;
  scaling?: Vector3;
}

interface ActiveDeathEffect {
  dispose: () => void;
  age: number;
  lifetime: number;
}

export class DeathEffectManager {
  private spawner: PrefabRuntimeSpawner | null = null;
  private readonly active: ActiveDeathEffect[] = [];
  private initialized = false;

  constructor(private readonly scene: Scene) {}

  async initialize(manifest: AssetManifest): Promise<void> {
    const [library, particlePresets] = await Promise.all([
      loadRuntimePrefabLibrary(),
      loadParticlePresets(),
    ]);

    this.spawner = new PrefabRuntimeSpawner(
      this.scene,
      library,
      listLodEditorModels(manifest),
      manifest,
      particlePresets,
      RuntimePaths.assetsBase,
    );
    this.initialized = true;
  }

  async preload(prefabIds: readonly string[]): Promise<void> {
    if (!this.spawner) return;
    await this.spawner.preload(prefabIds);
  }

  canSpawn(prefabId: string): boolean {
    return !!this.spawner?.hasTemplate(prefabId);
  }

  spawn(prefabId: string, kinematics: DeathEffectSpawnKinematics): boolean {
    if (!this.spawner) return false;

    const worldKinematics: PrefabWorldKinematics = {
      position: kinematics.position,
      rotationQuaternion: kinematics.rotationQuaternion,
      scaling: kinematics.scaling,
    };

    const instance = this.spawner.spawn(prefabId, worldKinematics);
    if (!instance) return false;

    this.active.push({
      dispose: () => instance.dispose(),
      age: 0,
      lifetime: DEATH_EFFECT_LIFETIME_SEC,
    });
    return true;
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      effect.age += dt;
      if (effect.age >= effect.lifetime) {
        effect.dispose();
        this.active.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const effect of this.active) {
      effect.dispose();
    }
    this.active.length = 0;
    this.spawner?.dispose();
    this.spawner = null;
    this.initialized = false;
  }

  get ready(): boolean {
    return this.initialized;
  }
}
