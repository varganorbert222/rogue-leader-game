import { Vector3, type Scene } from '@babylonjs/core';
import type { FactionId } from './faction';
import type { TargetingConfig } from '../config/combat-config';
import { getShipForward } from '../flight/ship-forward';
import type { HudScreenPoint } from '../flight/screen-project';
import { TargetingSystem, type ActiveTarget, type TargetEntity } from './targeting-system';
import type { VehicleWeaponSystem } from '../weapons/core/vehicle-weapon-system';
import type { CombatSystem } from '../weapons/combat-system';
export type AimSensorMode = 'screen' | 'radar';

export interface WeaponAimDebugInfo {
  aimOrigin: Vector3;
  aimDirection: Vector3;
  targetPosition: Vector3 | null;
  sensorMode: AimSensorMode;
  radarRadius: number;
}

export interface WeaponAimUpdateParams {
  scene: Scene;
  combat: CombatSystem;
  weapons: VehicleWeaponSystem;
  observerId: string;
  observerFaction: FactionId;
  observerPos: Vector3;
  observerVel: Vector3;
  aimAxis: Vector3;
  candidates: TargetEntity[];
  targeting: TargetingConfig;
  radarRadius: number;
  dt: number;
  mode: AimSensorMode;
  targetingSystem: TargetingSystem;
  reticle?: HudScreenPoint;
}

/** Unified weapon aim for player (screen) and NPC (radar) observers. */
export function updateWeaponAimForObserver(
  params: WeaponAimUpdateParams
): { target: ActiveTarget | null; debug: WeaponAimDebugInfo } {
  const axisOrigin = params.observerPos;
  const axisDirection = params.aimAxis;

  let target: ActiveTarget | null = null;

  if (params.mode === 'screen' && params.reticle) {
    target = params.targetingSystem.update(
      params.scene,
      params.observerFaction,
      params.observerPos,
      params.aimAxis,
      params.reticle,
      params.candidates,
      params.targeting
    );
  } else if (params.mode === 'radar') {
    target = params.targetingSystem.updateRadar(
      params.observerFaction,
      params.observerPos,
      params.aimAxis,
      params.candidates,
      params.radarRadius,
      params.targeting.targetConeHalfAngleDeg
    );
  }

  params.combat.updateWeaponAim(
    params.weapons,
    axisOrigin,
    axisDirection,
    target
      ? {
          position: target.position,
          velocity: target.velocity,
          distance: target.distance,
        }
      : null,
    params.observerVel,
    params.targeting,
    params.dt
  );

  const aimDirection = params.weapons.getPrimaryAimDirection(params.aimAxis);
  return {
    target,
    debug: {
      aimOrigin: axisOrigin.clone(),
      aimDirection: aimDirection.clone(),
      targetPosition: target?.position.clone() ?? null,
      sensorMode: params.mode,
      radarRadius: params.radarRadius,
    },
  };
}

export function observerAimAxis(
  rotation: import('@babylonjs/core').Quaternion
): Vector3 {
  return getShipForward(rotation);
}
