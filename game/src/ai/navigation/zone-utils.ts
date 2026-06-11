import { Vector3 } from '@babylonjs/core';
import type { WanderZoneDefinition } from './nav-types';

export function isInsideZone(position: Vector3, zone: WanderZoneDefinition): boolean {
  const center = Vector3.FromArray(zone.center);
  if (zone.type === 'cube') {
    const he = zone.halfExtents;
    const local = position.subtract(center);
    return (
      Math.abs(local.x) <= he[0] &&
      Math.abs(local.y) <= he[1] &&
      Math.abs(local.z) <= he[2]
    );
  }
  return Vector3.Distance(position, center) <= zone.radius;
}

export function isInsideAnyZone(
  position: Vector3,
  zones: WanderZoneDefinition[]
): boolean {
  return zones.some((zone) => isInsideZone(position, zone));
}

export function getZoneCenter(zone: WanderZoneDefinition): Vector3 {
  return Vector3.FromArray(zone.center);
}

/** Closest point on the zone boundary toward `position` (for return steering). */
export function getZoneReturnTarget(
  position: Vector3,
  zones: WanderZoneDefinition[]
): Vector3 {
  if (zones.length === 0) {
    return position.clone();
  }

  let bestCenter = getZoneCenter(zones[0]);
  let bestDist = Infinity;
  for (const zone of zones) {
    const center = getZoneCenter(zone);
    const dist = Vector3.Distance(position, center);
    if (dist < bestDist) {
      bestDist = dist;
      bestCenter = center;
    }
  }
  return bestCenter;
}
