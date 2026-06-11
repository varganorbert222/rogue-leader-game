import { Vector3 } from '@babylonjs/core';
import type { WanderZoneDefinition } from './nav-types';

/** Picks random targets inside one or more spherical zones. */
export class ZoneWanderer {
  private currentTarget: Vector3 | null = null;

  constructor(
    private readonly zones: WanderZoneDefinition[],
    private readonly retargetRadius: number
  ) {}

  getSteeringTarget(position: Vector3): Vector3 {
    if (this.zones.length === 0) {
      return position.clone();
    }

    if (
      !this.currentTarget ||
      Vector3.Distance(position, this.currentTarget) < this.retargetRadius
    ) {
      this.currentTarget = this.pickRandomPoint();
    }

    return this.currentTarget.clone();
  }

  getDebugTarget(position: Vector3): Vector3 {
    return this.getSteeringTarget(position);
  }

  getZoneDefinitions(): WanderZoneDefinition[] {
    return this.zones;
  }

  private pickRandomPoint(): Vector3 {
    const zone = this.zones[Math.floor(Math.random() * this.zones.length)];
    const center = Vector3.FromArray(zone.center);
    if (zone.type === 'cube') {
      const he = zone.halfExtents;
      return center.add(
        new Vector3(
          (Math.random() * 2 - 1) * he[0],
          (Math.random() * 2 - 1) * he[1],
          (Math.random() * 2 - 1) * he[2]
        )
      );
    }
    const dir = randomUnitVector();
    const dist = Math.cbrt(Math.random()) * zone.radius;
    return center.add(dir.scale(dist));
  }
}

function randomUnitVector(): Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
}
