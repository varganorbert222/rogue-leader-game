import { Quaternion, Vector3 } from '@babylonjs/core';
import { directionToVehicleInput } from '../flight/flight-steering';
import { getShipForward } from '../flight/ship-forward';
import type { NpcInput, NpcInputContext, NpcInputResult } from '../player/input/npc-input';
import {
  computeAlignment,
  computeCohesion,
  computeSeparation,
} from './boid-forces';

export type EnemyBehavior = 'attack' | 'chase' | 'flank';

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
      this.flankSide = Math.random() > 0.5 ? 1 : -1;
    }
  }

  update(dt: number, context: NpcInputContext): NpcInputResult {
    const pos = context.vehiclePosition;
    const toPlayer = context.playerPosition.clone().subtract(pos);
    const playerDist = toPlayer.length();
    const playerDir =
      playerDist > 0.01
        ? toPlayer.normalize()
        : getShipForward(context.vehicleRotation);

    this.updateDefensiveState(playerDist, dt);

    const separation = computeSeparation(
      pos,
      context.vehicleColliderRadius,
      context.flockMates
    );
    let moveDir: Vector3;

    if (this.defensive) {
      moveDir = this.computeDefensiveDirection(playerDir, playerDist);
      moveDir = this.blendSteering(
        moveDir,
        separation,
        Vector3.Zero(),
        Vector3.Zero(),
        playerDir,
        WEIGHT_SEPARATION_DEFENSIVE,
        0,
        0,
        0
      );
    } else {
      const alignment = computeAlignment(pos, context.flockMates);
      const cohesion = computeCohesion(pos, context.flockCenter);
      const flockInterest = this.computeFlockBehaviorDirection(playerDir, playerDist);
      moveDir = this.blendSteering(
        flockInterest,
        separation,
        alignment,
        cohesion,
        playerDir,
        WEIGHT_SEPARATION_FLOCK,
        WEIGHT_ALIGNMENT,
        WEIGHT_COHESION,
        WEIGHT_PLAYER_FLOCK
      );
    }

    if (moveDir.lengthSquared() < 1e-4) {
      moveDir = playerDir;
    } else {
      moveDir.normalize();
    }

    const fwd = getShipForward(context.vehicleRotation);
    const alignment = Vector3.Dot(fwd, moveDir);
    const targetSpeed = context.cruiseSpeed * (0.7 + alignment * 0.3);
    const speedDelta = targetSpeed - context.vehicleSpeed;
    const vehicle = directionToVehicleInput(context.vehicleRotation, moveDir, speedDelta);

    this.fireCooldown -= dt;
    let wantsFire = false;
    if (this.fireCooldown <= 0 && playerDist < 120) {
      this.fireCooldown = this.defensive
        ? this.behavior === 'attack'
          ? 0.8
          : 1.2
        : 1.4;
      wantsFire = true;
    }

    return { vehicle, wantsFire };
  }

  private updateDefensiveState(playerDist: number, dt: number): void {
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

  private computeDefensiveDirection(playerDir: Vector3, playerDist: number): Vector3 {
    if (this.behavior === 'flank' && playerDist > 60) {
      const right = Vector3.Cross(Vector3.Up(), playerDir).normalize();
      return playerDir.add(right.scale(this.flankSide * 0.6)).normalize();
    }
    return playerDir.clone();
  }

  private computeFlockBehaviorDirection(playerDir: Vector3, playerDist: number): Vector3 {
    if (this.behavior === 'flank' && playerDist > 80) {
      const right = Vector3.Cross(Vector3.Up(), playerDir).normalize();
      return playerDir.add(right.scale(this.flankSide * 0.35)).normalize();
    }
    if (this.behavior === 'chase') {
      return playerDir.clone();
    }
    return playerDir.scale(0.85).add(Vector3.Up().scale(0.05)).normalize();
  }

  private blendSteering(
    primary: Vector3,
    separation: Vector3,
    alignment: Vector3,
    cohesion: Vector3,
    playerDir: Vector3,
    wSep: number,
    wAli: number,
    wCoh: number,
    wPlayer: number
  ): Vector3 {
    return primary
      .clone()
      .add(separation.scale(wSep))
      .add(alignment.scale(wAli))
      .add(cohesion.scale(wCoh))
      .add(playerDir.scale(wPlayer));
  }
}

