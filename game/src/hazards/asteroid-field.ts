import {
  Quaternion,
  Vector3,
} from "@babylonjs/core";
import {
  ThinInstanceBatch,
  composeThinInstanceTransform,
} from "@rogue-leader/engine";
import type {
  GltfShipLoader,
  LoadedEntity,
  PropManifestEntry,
} from "@rogue-leader/engine";
import { HealthComponent } from "../actors/health-component";

export interface AsteroidConfig {
  prefabId: string;
  count: number;
  seed: number;
  spawnRegion: {
    type: "sphereShell";
    center: number[];
    innerRadius: number;
    outerRadius: number;
  };
  scaleRange: [number, number];
  damageOnImpact: number;
  slowTumble: boolean;
  maxAngularSpeed: number;
}

export interface AsteroidInstance {
  id: string;
  variantIndex: number;
  batchIndex: number;
  position: Vector3;
  rotationQuaternion: Quaternion;
  uniformScale: number;
  health: HealthComponent;
  /** Scaled sphere radius for batched collision. */
  colliderRadius: number;
  usesMeshCollider: boolean;
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

function buildVariantIndices(
  spawnCount: number,
  variantCount: number,
  rand: () => number,
): number[] {
  const picks: number[] = Array.from({ length: variantCount }, (_, i) => i);
  shuffleInPlace(picks, rand);

  while (picks.length < spawnCount) {
    picks.push(Math.floor(rand() * variantCount));
  }

  shuffleInPlace(picks, rand);
  return picks;
}

export class AsteroidField {
  readonly asteroids: AsteroidInstance[] = [];
  private batches: ThinInstanceBatch[] = [];
  private templates: LoadedEntity[] = [];
  private ownsTemplates = true;
  private baseColliderRadius = 3;

  async spawn(
    loader: GltfShipLoader,
    entry: PropManifestEntry,
    config: AsteroidConfig,
    playerSpawn: Vector3,
    preloadedTemplates?: readonly LoadedEntity[],
  ): Promise<void> {
    this.templates = preloadedTemplates?.length
      ? [...preloadedTemplates]
      : await loader.loadPropVariantTemplates(config.prefabId, entry);
    this.ownsTemplates = !preloadedTemplates?.length;
    this.baseColliderRadius = entry.colliderRadius;

    const scene = this.templates[0]?.root.getScene();
    if (!scene) return;

    this.batches = this.templates.map((template, variantIndex) =>
      ThinInstanceBatch.fromLoadedEntity(
        scene,
        `asteroid_var_${variantIndex}`,
        template,
      ),
    );

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
          rand() *
            (config.spawnRegion.outerRadius - config.spawnRegion.innerRadius);
        pos = center.add(
          new Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi),
          ),
        );
        attempts++;
      } while (Vector3.Distance(pos, playerSpawn) < 80 && attempts < 20);

      const variantIndex = variantIndices[i];
      const batch = this.batches[variantIndex];
      const scale =
        config.scaleRange[0] +
        rand() * (config.scaleRange[1] - config.scaleRange[0]);
      const id = `asteroid_${i}`;
      const rotation = Quaternion.Identity();

      const tumbleAxis = new Vector3(
        rand() - 0.5,
        rand() - 0.5,
        rand() - 0.5,
      ).normalize();
      const tumbleSpeed = config.slowTumble
        ? rand() * config.maxAngularSpeed
        : 0;

      const batchIndex = batch.add(
        id,
        composeThinInstanceTransform(pos, rotation, scale),
      );

      this.asteroids.push({
        id,
        variantIndex,
        batchIndex,
        position: pos.clone(),
        rotationQuaternion: rotation,
        uniformScale: scale,
        health: new HealthComponent(30, 30, 0, 0),
        colliderRadius: this.baseColliderRadius * scale,
        usesMeshCollider: false,
        tumbleAxis,
        tumbleSpeed,
      });
    }

    for (const batch of this.batches) {
      batch.flush();
    }
  }

  update(dt: number): void {
    for (const asteroid of this.asteroids) {
      if (asteroid.tumbleSpeed > 0) {
        const q = Quaternion.RotationAxis(asteroid.tumbleAxis, asteroid.tumbleSpeed * dt);
        asteroid.rotationQuaternion = asteroid.rotationQuaternion
          .multiply(q)
          .normalize();
      }

      const batch = this.batches[asteroid.variantIndex];
      batch.setTransform(
        asteroid.batchIndex,
        composeThinInstanceTransform(
          asteroid.position,
          asteroid.rotationQuaternion,
          asteroid.uniformScale,
        ),
      );
    }

    for (const batch of this.batches) {
      batch.flush();
    }
  }

  remove(id: string): void {
    const idx = this.asteroids.findIndex((a) => a.id === id);
    if (idx < 0) return;

    const asteroid = this.asteroids[idx];
    const batch = this.batches[asteroid.variantIndex];
    const movedId = batch.remove(id);
    batch.flush();
    if (movedId) {
      const moved = this.asteroids.find((entry) => entry.id === movedId);
      if (moved) {
        moved.batchIndex = batch.getIndexForId(movedId) ?? moved.batchIndex;
      }
    }

    this.asteroids.splice(idx, 1);
  }

  dispose(): void {
    for (const batch of this.batches) {
      batch.dispose();
    }
    this.batches = [];
    this.asteroids.length = 0;

    if (this.ownsTemplates) {
      for (const template of this.templates) {
        if (!template.root.isDisposed()) {
          template.root.dispose();
        }
      }
    }
    this.templates = [];
    this.ownsTemplates = true;
  }
}
