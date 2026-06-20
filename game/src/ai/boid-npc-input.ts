import { Vector3 } from '@babylonjs/core';
import { randomSign } from '@rogue-leader/engine';
import type { NpcBehaviorConfig, NpcStateId } from '../config/loaders/npc-behavior-config';
import { getShipForward } from '../flight/ship-forward';
import type { NpcInput, NpcInputContext, NpcInputResult } from '../player/input/npc-input';
import {
  computeAlignment,
  computeCohesion,
  computeSeparation,
} from './boid-forces';
import { tickBoidFireGate } from './combat-ai-utils';
import type { EnemyBehavior } from './enemy-behavior';
import {
  blendFlockSteering,
  computeDirectionToTarget,
  computeEnemyApproachDirection,
  normalizeSteerDirection,
  steeringToVehicleInput,
} from './steering-utils';

export type { EnemyBehavior } from './enemy-behavior';

const THREAT_ENTER_RADIUS = 95;
const THREAT_EXIT_RADIUS = 130;
const DEFENSIVE_LINGER_SEC = 4;

const WEIGHT_SEPARATION_FLOCK = 2.8;
const WEIGHT_SEPARATION_DEFENSIVE = 3.6;
const WEIGHT_ALIGNMENT = 0.9;
const WEIGHT_COHESION = 0.7;
const WEIGHT_PLAYER_FLOCK = 0.22;

/** Boid flock steering for NPC ships. */
export class BoidNpcInput implements NpcInput {
  private fireCooldown = 0;
  private flankSide = 1;
  private defensiveLinger = 0;
  private defensive = false;

  constructor(public readonly behavior: EnemyBehavior) {
    if (behavior === 'flank') {
      this.flankSide = randomSign();
    }
  }

  update(dt: number, context: NpcInputContext): NpcInputResult {
    const { direction: playerDir, distance: playerDist } = computeDirectionToTarget(
      context.vehiclePosition,
      context.playerPosition,
      getShipForward(context.vehicleRotation),
    );

    this.updateDefensiveState(playerDist, dt, context.playerIsHostile);

    const separation = computeSeparation(
      context.vehiclePosition,
      context.vehicleColliderRadius,
      context.flockMates,
    );
    let moveDir: Vector3;

    if (this.defensive) {
      moveDir = computeEnemyApproachDirection(
        this.behavior,
        playerDir,
        playerDist,
        this.flankSide,
        'defensive',
      );
      moveDir = blendFlockSteering(
        moveDir,
        separation,
        Vector3.Zero(),
        Vector3.Zero(),
        playerDir,
        {
          separation: WEIGHT_SEPARATION_DEFENSIVE,
          alignment: 0,
          cohesion: 0,
          playerChase: 0,
        },
      );
    } else {
      const alignment = computeAlignment(context.vehiclePosition, context.flockMates);
      const cohesion = computeCohesion(context.vehiclePosition, context.flockCenter);
      const flockInterest = computeEnemyApproachDirection(
        this.behavior,
        playerDir,
        playerDist,
        this.flankSide,
        'flock',
      );
      moveDir = blendFlockSteering(
        flockInterest,
        separation,
        alignment,
        cohesion,
        playerDir,
        {
          separation: WEIGHT_SEPARATION_FLOCK,
          alignment: WEIGHT_ALIGNMENT,
          cohesion: WEIGHT_COHESION,
          playerChase: WEIGHT_PLAYER_FLOCK,
        },
      );
    }

    moveDir = normalizeSteerDirection(moveDir, playerDir);

    const vehicle = steeringToVehicleInput(
      context.vehicleRotation,
      moveDir,
      context.cruiseSpeed,
      context.vehicleSpeed,
    );

    const fire = tickBoidFireGate(
      this.fireCooldown,
      dt,
      playerDist,
      this.behavior,
      this.defensive,
    );
    this.fireCooldown = fire.cooldownSec;

    return { vehicle, wantsFire: fire.wantsFire };
  }

  private updateDefensiveState(
    playerDist: number,
    dt: number,
    playerIsHostile: boolean,
  ): void {
    if (!playerIsHostile) {
      this.defensive = false;
      this.defensiveLinger = 0;
      return;
    }
    if (playerDist <= THREAT_ENTER_RADIUS) {
      this.defensive = true;
      this.defensiveLinger = DEFENSIVE_LINGER_SEC;
      return;
    }

    if (this.defensive) {
      this.defensiveLinger -= dt;
      if (playerDist >= THREAT_EXIT_RADIUS && this.defensiveLinger <= 0) {
        this.defensive = false;
      }
    }
  }
}
