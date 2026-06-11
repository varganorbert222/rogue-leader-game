import { Vector3, type Scene } from '@babylonjs/core';
import { isAutoAimCandidate, type FactionId } from './faction';
import type { TargetingConfig } from '../config/combat-config';
import { projectWorldToScreen, type HudScreenPoint } from '../flight/screen-project';
import { isTargetInAimHemisphere } from '../weapons/aim-solver';

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

export class TargetingSystem {
  private active: ActiveTarget | null = null;

  getActiveTarget(): ActiveTarget | null {
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

    if (
      this.active &&
      !this.refreshActiveTarget(
        scene,
        observerFaction,
        observerPos,
        aimAxis,
        reticle,
        candidates,
        config
      )
    ) {
      this.active = null;
    }

    if (this.active) {
      return this.active;
    }

    let best: ActiveTarget | null = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
      const parsed = evaluateCandidate(
        scene,
        observerFaction,
        observerPos,
        aimAxis,
        reticle,
        candidate,
        config
      );
      if (!parsed) continue;

      if (parsed.screenDist > config.targetScreenRadiusPct) continue;

      const score =
        parsed.screenDist * config.screenDistanceWeight +
        parsed.distance * config.worldDistanceWeight;

      if (score < bestScore) {
        bestScore = score;
        best = parsed.active;
      }
    }

    this.active = best;
    return best;
  }

  private refreshActiveTarget(
    scene: Scene,
    observerFaction: FactionId,
    observerPos: Vector3,
    aimAxis: Vector3,
    reticle: HudScreenPoint,
    candidates: TargetEntity[],
    config: TargetingConfig
  ): boolean {
    if (!this.active) return false;

    const candidate = candidates.find((c) => c.id === this.active!.id);
    if (!candidate) return false;

    const parsed = evaluateCandidate(
      scene,
      observerFaction,
      observerPos,
      aimAxis,
      reticle,
      candidate,
      config
    );
    if (!parsed) return false;
    if (parsed.screenDist > config.targetScreenRadiusPct) return false;

    this.active = parsed.active;
    return true;
  }
}

function screenDistanceFromReticle(point: HudScreenPoint, reticle: HudScreenPoint): number {
  return Math.hypot(point.xPct - reticle.xPct, point.yPct - reticle.yPct);
}

function evaluateCandidate(
  scene: Scene,
  observerFaction: FactionId,
  observerPos: Vector3,
  aimAxis: Vector3,
  reticle: HudScreenPoint,
  candidate: TargetEntity,
  config: TargetingConfig
): { active: ActiveTarget; screenDist: number; distance: number } | null {
  if (!isAutoAimCandidate(observerFaction, candidate.faction)) return null;
  if (!isTargetInAimHemisphere(observerPos, aimAxis, candidate.position)) return null;

  const distance = Vector3.Distance(observerPos, candidate.position);
  if (distance > config.autoAimRange) return null;

  const screenPoint = projectWorldToScreen(scene, candidate.position);
  if (!screenPoint.visible) return null;

  const screenDist = screenDistanceFromReticle(screenPoint, reticle);

  return {
    screenDist,
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
