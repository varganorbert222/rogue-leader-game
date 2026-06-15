import { Ray, Vector3, type AbstractMesh } from '@babylonjs/core';
import { ensureMeshWorldMatrix } from '@rogue-leader/engine';

export interface SphereBody {
  id: string;
  position: Vector3;
  radius: number;
  team?: 'player' | 'enemy' | 'neutral';
  faction?: 'rebel' | 'imperial' | 'neutral';
  velocity?: Vector3;
  /** Invisible `collider` / `collider_*` meshes — when present, hits use mesh ray tests. */
  colliderMeshes?: readonly AbstractMesh[];
}

/** Mesh collider takes precedence; sphere radius is used only without mesh colliders. */
export function buildSphereBody(body: {
  id: string;
  position: Vector3;
  radius: number;
  team?: SphereBody['team'];
  faction?: SphereBody['faction'];
  velocity?: Vector3;
  colliderMeshes?: readonly AbstractMesh[];
}): SphereBody {
  const meshColliders = body.colliderMeshes?.length ? body.colliderMeshes : undefined;
  return {
    id: body.id,
    position: body.position,
    team: body.team,
    faction: body.faction,
    velocity: body.velocity,
    radius: meshColliders ? 0 : body.radius,
    colliderMeshes: meshColliders,
  };
}

/** World-space bounding sphere for mesh colliders (or root fallback). */
export function getEffectiveCollisionBounds(
  body: SphereBody,
  fallbackRadius: number,
): { center: Vector3; radius: number } {
  const meshes = body.colliderMeshes;
  if (meshes?.length) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let any = false;

    for (const mesh of meshes) {
      if (mesh.isDisposed() || !mesh.isEnabled()) continue;
      ensureMeshWorldMatrix(mesh);
      const bounds = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bounds.minimumWorld.x);
      minY = Math.min(minY, bounds.minimumWorld.y);
      minZ = Math.min(minZ, bounds.minimumWorld.z);
      maxX = Math.max(maxX, bounds.maximumWorld.x);
      maxY = Math.max(maxY, bounds.maximumWorld.y);
      maxZ = Math.max(maxZ, bounds.maximumWorld.z);
      any = true;
    }

    if (any) {
      const center = new Vector3(
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5,
      );
      const half = new Vector3(
        (maxX - minX) * 0.5,
        (maxY - minY) * 0.5,
        (maxZ - minZ) * 0.5,
      );
      const radius = Math.max(half.x, half.y, half.z, 0.5);
      return { center, radius };
    }
  }

  return {
    center: body.position.clone(),
    radius: Math.max(fallbackRadius, body.radius, 0.5),
  };
}

export interface RaycastHit {
  hit: boolean;
  distance: number;
  point: Vector3;
}

export class CollisionSystem {
  sphereOverlap(a: SphereBody, b: SphereBody): boolean {
    if (a.colliderMeshes?.length || b.colliderMeshes?.length) {
      return this.colliderBodiesOverlap(a, b);
    }
    return Vector3.Distance(a.position, b.position) < a.radius + b.radius;
  }

  findOverlaps(body: SphereBody, others: SphereBody[]): SphereBody[] {
    return others.filter((o) => o.id !== body.id && this.sphereOverlap(body, o));
  }

  raycastSphere(
    origin: Vector3,
    direction: Vector3,
    target: SphereBody,
    maxDistance = 200
  ): RaycastHit {
    if (target.colliderMeshes?.length) {
      return this.raycastMeshColliders(origin, direction, target.colliderMeshes, maxDistance);
    }

    const oc = origin.subtract(target.position);
    const d = direction.normalize();
    const b = Vector3.Dot(oc, d);
    const c = Vector3.Dot(oc, oc) - target.radius * target.radius;
    const disc = b * b - c;
    if (disc < 0) {
      return { hit: false, distance: maxDistance, point: origin.add(d.scale(maxDistance)) };
    }
    const t = -b - Math.sqrt(disc);
    if (t < 0 || t > maxDistance) {
      return { hit: false, distance: maxDistance, point: origin.add(d.scale(maxDistance)) };
    }
    return { hit: true, distance: t, point: origin.add(d.scale(t)) };
  }

  raycastMeshColliders(
    origin: Vector3,
    direction: Vector3,
    meshes: readonly AbstractMesh[],
    maxDistance: number
  ): RaycastHit {
    const dir = direction.clone().normalize();
    const ray = new Ray(origin, dir, maxDistance);
    let closest = maxDistance + 1;
    let hitPoint = origin.add(dir.scale(maxDistance));
    let anyHit = false;

    for (const mesh of meshes) {
      if (mesh.isDisposed() || !mesh.isEnabled()) continue;
      ensureMeshWorldMatrix(mesh);
      const pick = ray.intersectsMesh(mesh, false);
      if (!pick.hit || pick.distance === undefined || pick.distance > maxDistance) continue;
      if (pick.distance >= closest) continue;
      closest = pick.distance;
      hitPoint = pick.pickedPoint?.clone() ?? origin.add(dir.scale(pick.distance));
      anyHit = true;
    }

    return {
      hit: anyHit,
      distance: anyHit ? closest : maxDistance,
      point: hitPoint,
    };
  }

  /** Sphere vs mesh collider set (bounding-sphere broad phase per mesh). */
  sphereOverlapsMeshColliders(body: SphereBody): boolean {
    if (!body.colliderMeshes?.length) return false;
    return this.sphereOverlapsMeshCollidersAt(body.position, body.radius, body.colliderMeshes);
  }

  sphereOverlapsMeshCollidersAt(
    position: Vector3,
    radius: number,
    meshes: readonly AbstractMesh[]
  ): boolean {
    for (const mesh of meshes) {
      if (mesh.isDisposed() || !mesh.isEnabled()) continue;
      ensureMeshWorldMatrix(mesh);
      const bounds = mesh.getBoundingInfo().boundingSphere;
      if (Vector3.Distance(position, bounds.centerWorld) < radius + bounds.radiusWorld) {
        return true;
      }
    }
    return false;
  }

  private colliderBodiesOverlap(a: SphereBody, b: SphereBody): boolean {
    const aMeshes = a.colliderMeshes ?? [];
    const bMeshes = b.colliderMeshes ?? [];

    if (aMeshes.length && bMeshes.length) {
      for (const am of aMeshes) {
        if (am.isDisposed() || !am.isEnabled()) continue;
        ensureMeshWorldMatrix(am);
        const aBounds = am.getBoundingInfo().boundingSphere;
        for (const bm of bMeshes) {
          if (bm.isDisposed() || !bm.isEnabled()) continue;
          ensureMeshWorldMatrix(bm);
          const bBounds = bm.getBoundingInfo().boundingSphere;
          if (
            Vector3.Distance(aBounds.centerWorld, bBounds.centerWorld) <
            aBounds.radiusWorld + bBounds.radiusWorld
          ) {
            return true;
          }
        }
      }
      return false;
    }

    if (aMeshes.length && !bMeshes.length) {
      return this.sphereOverlapsMeshCollidersAt(b.position, b.radius, aMeshes);
    }
    if (bMeshes.length && !aMeshes.length) {
      return this.sphereOverlapsMeshCollidersAt(a.position, a.radius, bMeshes);
    }

    return Vector3.Distance(a.position, b.position) < a.radius + b.radius;
  }
}
