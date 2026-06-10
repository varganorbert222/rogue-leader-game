import { Quaternion, Scalar, Vector3, type TransformNode } from '@babylonjs/core';
import { MIN_FLIGHT_SPEED } from '../flight/flight-constants';
import { getShipForward, shipRotationFromHeading } from '../flight/ship-forward';
import {
  computeAlignment,
  computeCohesion,
  computeSeparation,
  resolveFlockOverlap,
} from './boid-forces';
import type { EnemyAIContext } from './flock-types';

export type EnemyBehavior = 'attack' | 'chase' | 'flank';

const THREAT_ENTER_RADIUS = 95;
const THREAT_EXIT_RADIUS = 130;
const DEFENSIVE_LINGER_SEC = 4;

const WEIGHT_SEPARATION_FLOCK = 2.8;
const WEIGHT_SEPARATION_DEFENSIVE = 3.6;
const WEIGHT_ALIGNMENT = 0.9;
const WEIGHT_COHESION = 0.7;
const WEIGHT_PLAYER_FLOCK = 0.22;

export class BoidEnemyAI {
  private fireCooldown = 0;
  private flankSide = 1;
  private speed: number;
  private readonly velocity = Vector3.Zero();
  private defensiveLinger = 0;
  private defensive = false;

  constructor(
    public readonly root: TransformNode,
    public readonly behavior: EnemyBehavior,
    public readonly colliderRadius: number,
    private readonly cruiseSpeed = 35,
    private readonly minSpeed = MIN_FLIGHT_SPEED
  ) {
    this.speed = cruiseSpeed;
    if (behavior === 'flank') {
      this.flankSide = Math.random() > 0.5 ? 1 : -1;
    }
  }

  getVelocity(): Vector3 {
    return this.velocity.clone();
  }

  update(dt: number, context: EnemyAIContext, onFire: () => void): void {
    const pos = this.root.position;
    const toPlayer = context.playerPos.clone().subtract(pos);
    const playerDist = toPlayer.length();
    const playerDir =
      playerDist > 0.01
        ? toPlayer.normalize()
        : getShipForward(this.root.rotationQuaternion ?? Quaternion.Identity());

    this.updateDefensiveState(playerDist, dt);

    const separation = computeSeparation(
      pos,
      this.colliderRadius,
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
      const flockInterest = this.computeFlockBehaviorDirection(
        playerDir,
        playerDist
      );
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

    if (playerDist > 5) {
      this.root.rotationQuaternion = shipRotationFromHeading(moveDir);
    }

    const rot = this.root.rotationQuaternion ?? Quaternion.Identity();
    const fwd = getShipForward(rot);
    const alignment = Vector3.Dot(fwd, moveDir);
    const targetSpeed = Scalar.Clamp(
      this.cruiseSpeed * (0.7 + alignment * 0.3),
      this.minSpeed,
      this.cruiseSpeed * 1.1
    );
    this.speed = Scalar.Lerp(this.speed, targetSpeed, 1 - Math.pow(0.02, dt));
    this.speed = Math.max(this.minSpeed, this.speed);

    this.velocity.copyFrom(fwd.scale(this.speed));
    pos.addInPlace(this.velocity.scale(dt));
    resolveFlockOverlap(pos, this.colliderRadius, context.flockMates);

    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && playerDist < 120) {
      this.fireCooldown = this.defensive
        ? this.behavior === 'attack'
          ? 0.8
          : 1.2
        : 1.4;
      onFire();
    }
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

  private computeFlockBehaviorDirection(
    playerDir: Vector3,
    playerDist: number
  ): Vector3 {
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
    const blended = primary
      .clone()
      .add(separation.scale(wSep))
      .add(alignment.scale(wAli))
      .add(cohesion.scale(wCoh))
      .add(playerDir.scale(wPlayer));
    return blended;
  }
}
