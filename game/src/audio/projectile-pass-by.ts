import { Vector3 } from '@babylonjs/core';
import { closestPointOnSegment } from '@rogue-leader/engine';
import { CombatTeams, type CombatTeamId } from '../config/constants/combat-teams';

export interface ProjectileNearMiss {
  weaponId: string;
  point: Vector3;
}

/** Camera / listener used for near-miss detection. */
export interface ProjectilePassByObserver {
  position: Vector3;
  /** Only projectiles hostile to this team trigger whoosh. */
  team: CombatTeamId;
}

const WHOOSH_CLEARANCE = 16;
const WHOOSH_MIN_TRAVEL = 10;

export function detectProjectileNearMiss(
  prev: Vector3,
  next: Vector3,
  observer: ProjectilePassByObserver,
  projectileTeam: CombatTeamId,
  distanceTraveled: number,
): boolean {
  if (projectileTeam === observer.team || projectileTeam === CombatTeams.Neutral) {
    return false;
  }
  if (distanceTraveled < WHOOSH_MIN_TRAVEL) return false;

  const closest = closestPointOnSegment(prev, next, observer.position);
  return Vector3.Distance(closest, observer.position) <= WHOOSH_CLEARANCE;
}
