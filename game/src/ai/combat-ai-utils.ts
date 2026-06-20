import type { NpcBehaviorConfig, NpcStateId } from '../config/loaders/npc-behavior-config';
import type { FlockCombatRole } from './navigation/nav-types';
import type { EnemyBehavior } from './enemy-behavior';

const BOID_FIRE_RANGE = 120;

export function npcFireIntervalSec(behavior: EnemyBehavior, defensive: boolean): number {
  if (!defensive) return 1.4;
  return behavior === 'attack' ? 0.8 : 1.2;
}

export function tickFireCooldown(
  cooldownSec: number,
  dt: number,
  playerDist: number,
  fireRange: number,
  intervalSec: number,
): { cooldownSec: number; wantsFire: boolean } {
  const nextCooldown = cooldownSec - dt;
  if (nextCooldown > 0 || playerDist >= fireRange) {
    return { cooldownSec: nextCooldown, wantsFire: false };
  }
  return { cooldownSec: intervalSec, wantsFire: true };
}

export function tickBoidFireGate(
  cooldownSec: number,
  dt: number,
  playerDist: number,
  behavior: EnemyBehavior,
  defensive: boolean,
  fireRange = BOID_FIRE_RANGE,
): { cooldownSec: number; wantsFire: boolean } {
  return tickFireCooldown(
    cooldownSec,
    dt,
    playerDist,
    fireRange,
    npcFireIntervalSec(behavior, defensive),
  );
}

export function tickBehaviorNpcFireGate(
  cooldownSec: number,
  dt: number,
  playerDist: number,
  config: Pick<NpcBehaviorConfig, 'fireRange'>,
  combatRole: FlockCombatRole,
  state: NpcStateId,
  inZone: boolean,
  behaviorStyle: EnemyBehavior,
): { cooldownSec: number; wantsFire: boolean } {
  const nextCooldown = cooldownSec - dt;
  if (nextCooldown > 0) {
    return { cooldownSec: nextCooldown, wantsFire: false };
  }

  if (combatRole === 'patrol_only') {
    return { cooldownSec: nextCooldown, wantsFire: false };
  }

  if (combatRole === 'wander_guard') {
    if (state !== 'chase' || !inZone || playerDist > config.fireRange * 0.65) {
      return { cooldownSec: nextCooldown, wantsFire: false };
    }
    return { cooldownSec: 1.4, wantsFire: true };
  }

  if (state !== 'attack' || playerDist >= config.fireRange) {
    return { cooldownSec: nextCooldown, wantsFire: false };
  }

  return {
    cooldownSec: behaviorStyle === 'attack' ? 0.8 : 1.2,
    wantsFire: true,
  };
}
