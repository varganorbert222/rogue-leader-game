import { Vector3 } from '@babylonjs/core';
import { CombatTeams, type CombatTeamId } from '../data/constants/combat-teams';

export interface ProjectileNearMiss {
  weaponId: string;
  point: Vector3;
}

export interface ProjectilePassByObserver {
  position: Vector3;
  /** Only projectiles hostile to this team trigger whoosh. */
  team: CombatTeamId;
}

const WHOOSH_CLEARANCE = 16;
const WHOOSH_MIN_TRAVEL = 10;

export function closestPointOnSegment(a: Vector3, b: Vector3, p: Vector3): Vector3 {
  const ab = b.subtract(a);
  const lenSq = ab.lengthSquared();
  if (lenSq < 1e-6) return a.clone();
  const t = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / lenSq));
  return a.add(ab.scale(t));
}

export function detectProjectileNearMiss(
  prev: Vector3,
  next: Vector3,
  observer: ProjectilePassByObserver,
  projectileTeam: CombatTeamId,
  distanceTraveled: number
): boolean {
  if (projectileTeam === observer.team || projectileTeam === CombatTeams.Neutral) return false;
  if (distanceTraveled < WHOOSH_MIN_TRAVEL) return false;

  const closest = closestPointOnSegment(prev, next, observer.position);
  return Vector3.Distance(closest, observer.position) <= WHOOSH_CLEARANCE;
}
