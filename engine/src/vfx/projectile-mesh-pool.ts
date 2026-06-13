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

function visualKey(visual: ProjectileVisualConfig): string {
  return `${visual.boltLength}|${visual.boltDiameter}|${visual.emissive.join(',')}`;
}

export class ProjectileMeshPool {
  private readonly pools = new Map<string, ObjectPool<PooledProjectileMesh>>();

  acquire(scene: Scene, visual: ProjectileVisualConfig): PooledProjectileMesh {
    const key = visualKey(visual);
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
    this.pools.get(visualKey(visual))?.release(slot);
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
    key: string
  ): PooledProjectileMesh {
    const mesh = MeshBuilder.CreateCylinder(
      `projectile_${key}`,
      {
        diameter: visual.boltDiameter,
        height: visual.boltLength,
        tessellation: 6,
      },
      scene
    );
    const material = new StandardMaterial(`projectileMat_${key}`, scene);
    material.emissiveColor.set(visual.emissive[0], visual.emissive[1], visual.emissive[2]);
    material.disableLighting = true;
    material.alpha = 0.95;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { mesh, material };
  }
}

export function syncProjectileMeshTransform(
  mesh: Mesh,
  position: Vector3,
  direction: Vector3
): void {
  mesh.position.copyFrom(position);
  if (direction.lengthSquared() < 1e-6) return;
  mesh.lookAt(position.add(direction));
  mesh.rotation.x += Math.PI / 2;
}
