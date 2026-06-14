import {
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { ObjectPool } from '../pool/object-pool';
import type { ProjectileVisualConfig } from './projectile-visual';

export interface PooledProjectileMesh {
  mesh: Mesh;
  material: StandardMaterial;
}

const DEFAULT_TAIL_WIDTH_RATIO = 0.12;

function visualKey(
  visual: ProjectileVisualConfig,
  bloomStrength: number,
): string {
  const tail = visual.tailWidthRatio ?? DEFAULT_TAIL_WIDTH_RATIO;
  return `${visual.length}|${visual.width}|${tail}|${bloomStrength}|${visual.emissive.join(',')}`;
}

/** Lathe profile: Y spans [-length/2, +length/2] (total length in meters). */
function createTeardropProfile(
  length: number,
  width: number,
  tailWidthRatio: number,
): Vector3[] {
  const half = length / 2;
  const maxRadius = width / 2;
  const tailRadius = (width * tailWidthRatio) / 2;
  return [
    new Vector3(0, -half, 0),
    new Vector3(tailRadius, -half * 0.62, 0),
    new Vector3(maxRadius * 0.72, -half * 0.08, 0),
    new Vector3(maxRadius, half * 0.28, 0),
    new Vector3(maxRadius * 0.58, half * 0.72, 0),
    new Vector3(maxRadius * 0.18, half * 0.96, 0),
    new Vector3(0, half, 0),
  ];
}

export class ProjectileMeshPool {
  private readonly pools = new Map<string, ObjectPool<PooledProjectileMesh>>();
  private bloomStrength = 1;

  setBloomStrength(strength: number): void {
    this.bloomStrength = Math.max(0, strength);
  }

  acquire(scene: Scene, visual: ProjectileVisualConfig): PooledProjectileMesh {
    const key = visualKey(visual, this.bloomStrength);
    let pool = this.pools.get(key);
    if (!pool) {
      pool = ObjectPool.create({
        factory: () => this.createMesh(scene, visual, key),
        reset: (slot) => {
          slot.mesh.setEnabled(false);
          slot.mesh.isVisible = false;
          slot.mesh.parent = null;
        },
        destroy: (slot) => {
          slot.mesh.dispose();
          slot.material.dispose();
        },
        maxSize: 48,
      });
      pool.prewarm(16);
      this.pools.set(key, pool);
    }
    return pool.acquire();
  }

  release(visual: ProjectileVisualConfig, slot: PooledProjectileMesh): void {
    slot.mesh.setEnabled(false);
    slot.mesh.isVisible = false;
    slot.mesh.parent = null;
    this.pools.get(visualKey(visual, this.bloomStrength))?.release(slot);
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      pool.drain();
    }
    this.pools.clear();
  }

  private createMesh(
    scene: Scene,
    visual: ProjectileVisualConfig,
    key: string,
  ): PooledProjectileMesh {
    const tailRatio = visual.tailWidthRatio ?? DEFAULT_TAIL_WIDTH_RATIO;
    const mesh = MeshBuilder.CreateLathe(
      `projectile_${key}`,
      {
        shape: createTeardropProfile(visual.length, visual.width, tailRatio),
        tessellation: 12,
        cap: Mesh.CAP_ALL,
        updatable: false,
      },
      scene,
    );
    const material = new StandardMaterial(`projectileMat_${key}`, scene);
    material.emissiveColor.set(
      visual.emissive[0] * this.bloomStrength,
      visual.emissive[1] * this.bloomStrength,
      visual.emissive[2] * this.bloomStrength,
    );
    material.disableLighting = true;
    material.alpha = 0.98;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, material };
  }
}

export function syncProjectileMeshTransform(
  mesh: Mesh,
  position: Vector3,
  direction: Vector3,
  length?: number,
): void {
  const dir = direction.clone();
  let center = position;
  if (length !== undefined && length > 0) {
    if (dir.lengthSquared() < 1e-6) {
      mesh.position.copyFrom(position);
      return;
    }
    dir.normalize();
    center = position.add(dir.scale(length / 2));
  } else if (dir.lengthSquared() < 1e-6) {
    mesh.position.copyFrom(position);
    return;
  } else {
    dir.normalize();
  }

  mesh.position.copyFrom(center);
  mesh.lookAt(center.add(dir));
  mesh.rotation.x += Math.PI / 2;
}
