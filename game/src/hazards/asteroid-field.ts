import {

  Quaternion,

  Vector3,

  type AbstractMesh,

  type TransformNode,

} from "@babylonjs/core";

import type {

  GltfShipLoader,

  LoadedEntity,

  PropInstanceGroup,

  PropManifestEntry,

} from "@rogue-leader/engine";

import { setLoadedEntityVisible } from "@rogue-leader/engine";

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

  root: TransformNode;

  lodRuntime: import("@rogue-leader/engine").LodRuntimeState;

  health: HealthComponent;

  /** Sphere fallback radius — 0 when `usesMeshCollider` is true. */

  colliderRadius: number;

  colliderMeshes: readonly AbstractMesh[];

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



/** Every variant at least once, then random picks; full list shuffled. */

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

  private templates: LoadedEntity[] = [];

  private variantGroups: (PropInstanceGroup | null)[] = [];

  private ownsTemplates = true;



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

    const variantCount = this.templates.length;

    const rand = seededRandom(config.seed);

    const spawnCount = Math.max(config.count, variantCount);

    const variantIndices = buildVariantIndices(spawnCount, variantCount, rand);

    const center = Vector3.FromArray(config.spawnRegion.center);



    this.variantGroups = this.templates.map((template, variantIndex) => {

      const variantName =

        entry.variants?.[variantIndex]?.split("/").pop()?.replace(/\.glb$/i, "") ??

        `${config.prefabId}_${variantIndex}`;

      if (template.isPlaceholder) {

        loader.preparePropInstanceTemplate(template);

        return null;

      }

      return loader.createPropInstanceGroup(

        template,

        `asteroid_${variantName}`,

        entry,

      );

    });



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

      const template = this.templates[variantIndex];

      const group = this.variantGroups[variantIndex];

      const instanceId = `asteroid_${i}`;

      const loaded = group

        ? group.spawn(instanceId)

        : loader.instanceProp(template, instanceId, entry);

      setLoadedEntityVisible(loaded, true);

      loaded.root.position = pos;

      const scale =

        config.scaleRange[0] +

        rand() * (config.scaleRange[1] - config.scaleRange[0]);

      loaded.root.scaling.scaleInPlace(scale);



      const tumbleAxis = new Vector3(

        rand() - 0.5,

        rand() - 0.5,

        rand() - 0.5,

      ).normalize();

      const tumbleSpeed = config.slowTumble

        ? rand() * config.maxAngularSpeed

        : 0;



      const colliderMeshes =
        loaded.colliderMeshes.length > 0
          ? loaded.colliderMeshes
          : entry.colliderSource === "visual"
            ? loaded.meshes
            : [];
      const usesMeshCollider = colliderMeshes.length > 0;



      this.asteroids.push({

        id: instanceId,

        variantIndex,

        root: loaded.root,

        lodRuntime: loaded.lodRuntime,

        health: new HealthComponent(30, 30, 0, 0),

        colliderRadius: usesMeshCollider ? 0 : loaded.colliderRadius * scale,

        colliderMeshes,

        usesMeshCollider,

        tumbleAxis,

        tumbleSpeed,

      });

    }

  }



  update(dt: number): void {

    for (const a of this.asteroids) {

      if (a.tumbleSpeed > 0) {

        const q = Quaternion.RotationAxis(a.tumbleAxis, a.tumbleSpeed * dt);

        a.root.rotationQuaternion = (

          a.root.rotationQuaternion ?? Quaternion.Identity()

        )

          .multiply(q)

          .normalize();

      }

    }

  }



  collectLodRuntimes(): import("@rogue-leader/engine").LodRuntimeState[] {
    return this.asteroids.map((asteroid) => asteroid.lodRuntime);
  }



  remove(id: string): void {

    const idx = this.asteroids.findIndex((a) => a.id === id);

    if (idx < 0) return;



    const asteroid = this.asteroids[idx];

    const group = this.variantGroups[asteroid.variantIndex];

    if (group?.has(id)) {

      group.remove(id);

    } else if (!asteroid.root.isDisposed()) {

      asteroid.root.dispose();

    }

    this.asteroids.splice(idx, 1);

  }



  dispose(): void {

    this.asteroids.length = 0;

    for (const group of this.variantGroups) {

      group?.dispose();

    }

    this.variantGroups = [];

    if (this.ownsTemplates) {

      this.templates.forEach((t) => t.root.dispose());

    }

    this.templates = [];

    this.ownsTemplates = true;

  }

}


