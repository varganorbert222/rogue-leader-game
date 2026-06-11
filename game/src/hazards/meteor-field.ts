import { Quaternion, Vector3, type TransformNode } from '@babylonjs/core';
import type { GltfShipLoader, LoadedEntity } from '@rogue-leader/engine';
import type { PropManifestEntry } from '@rogue-leader/engine';
import { HealthComponent } from '../entities/health-component';

export interface MeteorConfig {
  prefabId: string;
  count: number;
  seed: number;
  spawnRegion: {
    type: 'sphereShell';
    center: number[];
    innerRadius: number;
    outerRadius: number;
  };
  scaleRange: [number, number];
  damageOnImpact: number;
  slowTumble: boolean;
  maxAngularSpeed: number;
}

export interface MeteorInstance {
  id: string;
  root: TransformNode;
  health: HealthComponent;
  colliderRadius: number;
  tumbleAxis: Vector3;
  tumbleSpeed: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shuffleInPlace<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/** Every variant at least once, then random picks; full list shuffled. */
function buildVariantIndices(
  spawnCount: number,
  variantCount: number,
  rand: () => number
): number[] {
  const picks: number[] = Array.from({ length: variantCount }, (_, i) => i);
  shuffleInPlace(picks, rand);

  while (picks.length < spawnCount) {
    picks.push(Math.floor(rand() * variantCount));
  }

  shuffleInPlace(picks, rand);
  return picks;
}

export class MeteorField {
  readonly meteors: MeteorInstance[] = [];
  private templates: LoadedEntity[] = [];

  async spawn(
    loader: GltfShipLoader,
    entry: PropManifestEntry,
    config: MeteorConfig,
    playerSpawn: Vector3
  ): Promise<void> {
    this.templates = await loader.loadPropVariantTemplates(config.prefabId, entry);
    const variantCount = this.templates.length;
    const rand = seededRandom(config.seed);
    const spawnCount = Math.max(config.count, variantCount);
    const variantIndices = buildVariantIndices(spawnCount, variantCount, rand);
    const center = Vector3.FromArray(config.spawnRegion.center);

    for (let i = 0; i < spawnCount; i++) {
      let pos: Vector3;
      let attempts = 0;
      do {
        const u = rand();
        const v = rand();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r =
          config.spawnRegion.innerRadius +
          rand() * (config.spawnRegion.outerRadius - config.spawnRegion.innerRadius);
        pos = center.add(
          new Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
          )
        );
        attempts++;
      } while (Vector3.Distance(pos, playerSpawn) < 80 && attempts < 20);

      const template = this.templates[variantIndices[i]];
      const loaded = loader.cloneProp(template, `meteor_${i}`);
      loaded.root.position = pos;
      const scale =
        config.scaleRange[0] + rand() * (config.scaleRange[1] - config.scaleRange[0]);
      loaded.root.scaling.scaleInPlace(scale);

      const tumbleAxis = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const tumbleSpeed = config.slowTumble ? rand() * config.maxAngularSpeed : 0;

      this.meteors.push({
        id: `meteor_${i}`,
        root: loaded.root,
        health: new HealthComponent(30, 30, 0, 0),
        colliderRadius: loaded.colliderRadius * scale,
        tumbleAxis,
        tumbleSpeed,
      });
    }
  }

  update(dt: number): void {
    for (const m of this.meteors) {
      if (m.tumbleSpeed > 0) {
        const q = Quaternion.RotationAxis(m.tumbleAxis, m.tumbleSpeed * dt);
        m.root.rotationQuaternion = (m.root.rotationQuaternion ?? Quaternion.Identity())
          .multiply(q)
          .normalize();
      }
    }
  }

  remove(id: string): void {
    const idx = this.meteors.findIndex((m) => m.id === id);
    if (idx >= 0) {
      this.meteors[idx].root.dispose();
      this.meteors.splice(idx, 1);
    }
  }

  dispose(): void {
    this.meteors.forEach((m) => m.root.dispose());
    this.meteors.length = 0;
    this.templates.forEach((t) => t.root.dispose());
    this.templates = [];
  }
}
