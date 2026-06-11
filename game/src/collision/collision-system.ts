import { Vector3 } from '@babylonjs/core';

export interface SphereBody {
  id: string;
  position: Vector3;
  radius: number;
  team?: 'player' | 'enemy' | 'neutral';
  faction?: 'rebel' | 'imperial' | 'neutral';
  velocity?: Vector3;
}

export class CollisionSystem {
  sphereOverlap(a: SphereBody, b: SphereBody): boolean {
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
  ): { hit: boolean; distance: number; point: Vector3 } {
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
}
