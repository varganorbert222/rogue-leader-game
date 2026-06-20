import { Vector3, type Scene } from '@babylonjs/core';
import { angularOffsetDeg } from '@rogue-leader/engine';
import { isAutoAimCandidate, type FactionId } from '../faction';
import type { TargetingConfig } from '../../config/loaders/combat-config';
import { projectWorldToScreen, type HudScreenPoint } from '../../flight/screen-project';
import { isTargetInAimHemisphere } from './aim-solver';
import { isInsideAimCone } from './targeting-cone';

export interface TargetEntity {
  id: string;
  faction: FactionId;
  position: Vector3;
  velocity: Vector3;
  radius: number;
}

export interface ActiveTarget {
  id: string;
  position: Vector3;
  velocity: Vector3;
  distance: number;
  screenPoint: HudScreenPoint;
}

interface ScoredCandidate {
  active: ActiveTarget;
  angleDeg: number;
  distance: number;
}

export class TargetingSystem {
  private active: ActiveTarget | null = null;

  getActiveTarget(): ActiveTarget | null {
    return this.active;
  }

  clear(): void {
    this.active = null;
  }

  /** Radar-based lock — angular cone priority, then world distance. */
  updateRadar(
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    candidates: TargetEntity[],
    radius: number,
    coneHalfAngleDeg: number
  ): ActiveTarget | null {
    this.active = this.pickBestInCone(
      observerFaction,
      observerPos,
      aimAxis,
      candidates,
      coneHalfAngleDeg,
      radius
    );
    return this.active;
  }

  update(
    scene: Scene,
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    reticle: HudScreenPoint,
    candidates: TargetEntity[],
    config: TargetingConfig
  ): ActiveTarget | null {
    if (!reticle.visible) {
      this.active = null;
      return null;
    }

    const scored = this.scoreCandidates(
      scene,
      observerFaction,
      observerPos,
      aimAxis,
      reticle,
      candidates,
      config
    );

    this.active = this.pickBestScored(scored);
    return this.active;
  }

  private scoreCandidates(
    scene: Scene,
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    reticle: HudScreenPoint,
    candidates: TargetEntity[],
    config: TargetingConfig
  ): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const parsed = this.evaluateCandidate(
        scene,
        observerFaction,
        observerPos,
        aimAxis,
        candidate,
        config
      );
      if (!parsed) continue;
      scored.push(parsed);
    }

    return scored;
  }

  private pickBestInCone(
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    candidates: TargetEntity[],
    coneHalfAngleDeg: number,
    maxRange: number
  ): ActiveTarget | null {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      if (!isAutoAimCandidate(observerFaction, candidate.faction)) continue;
      if (!isTargetInAimHemisphere(observerPos, aimAxis, candidate.position)) continue;

      const distance = Vector3.Distance(observerPos, candidate.position);
      if (distance > maxRange) continue;

      const angleDeg = angularOffsetDeg(observerPos, aimAxis, candidate.position);
      if (angleDeg > coneHalfAngleDeg) continue;

      scored.push({
        angleDeg,
        distance,
        active: {
          id: candidate.id,
          position: candidate.position.clone(),
          velocity: candidate.velocity.clone(),
          distance,
          screenPoint: { xPct: 50, yPct: 50, visible: true },
        },
      });
    }

    return this.pickBestScored(scored);
  }

  private pickBestScored(scored: ScoredCandidate[]): ActiveTarget | null {
    if (scored.length === 0) return null;

    scored.sort((a, b) => {
      if (a.angleDeg !== b.angleDeg) return a.angleDeg - b.angleDeg;
      return a.distance - b.distance;
    });

    return scored[0].active;
  }

  private evaluateCandidate(
    scene: Scene,
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    candidate: TargetEntity,
    config: TargetingConfig
  ): ScoredCandidate | null {
    if (!isAutoAimCandidate(observerFaction, candidate.faction)) return null;
    if (!isTargetInAimHemisphere(observerPos, aimAxis, candidate.position)) return null;

    const distance = Vector3.Distance(observerPos, candidate.position);
    if (distance > config.autoAimRange) return null;

    const angleDeg = angularOffsetDeg(observerPos, aimAxis, candidate.position);
    if (!isInsideAimCone(observerPos, aimAxis, candidate.position, config.targetConeHalfAngleDeg)) {
      return null;
    }

    const screenPoint = projectWorldToScreen(scene, candidate.position);
    if (!screenPoint.visible) return null;

    return {
      angleDeg,
      distance,
      active: {
        id: candidate.id,
        position: candidate.position.clone(),
        velocity: candidate.velocity.clone(),
        distance,
        screenPoint,
      },
    };
  }
}
