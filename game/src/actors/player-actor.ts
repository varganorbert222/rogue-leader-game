import { Quaternion, type Scene, Vector3 } from '@babylonjs/core';
import type { FactionId } from '../combat/faction';
import { TargetingSystem, type TargetEntity } from '../combat/targeting-system';
import {
  updateWeaponAimForObserver,
  type WeaponAimDebugInfo,
} from '../combat/weapon-aim-controller';
import type { TargetingConfig } from '../config/combat-config';
import type { SphereBody } from '../collision/collision-system';
import type { HealthComponent } from '../entities/health-component';
import type { CameraController } from '../flight/camera-controller';
import { RETICLE_INNER_DISTANCE } from '../flight/flight-constants';
import { projectWorldToScreen } from '../flight/screen-project';
import { getShipForward } from '../flight/ship-forward';
import type { SoftBoundary } from '../flight/soft-boundary';
import type { PlayerInput } from '../input/player-input';
import type { CombatSystem } from '../weapons/combat-system';
import type { Vehicle } from '../vehicles/vehicle';
import type { Actor, ActorRole } from './actor';

export interface PlayerActorUpdateContext {
  dt: number;
  scene: Scene;
  input: PlayerInput;
  boundary?: SoftBoundary;
  camera: CameraController;
  combat: CombatSystem;
  targetingConfig: TargetingConfig;
  radarRadius: number;
  hostileTargets: TargetEntity[];
}

export class PlayerActor implements Actor {
  readonly role: ActorRole = 'player';
  readonly targeting = new TargetingSystem();
  lastAimDebug: WeaponAimDebugInfo | null = null;

  constructor(
    readonly id: string,
    readonly health: HealthComponent,
    public vehicle: Vehicle,
    readonly faction: FactionId
  ) {}

  getColliderRadius(): number {
    return this.vehicle.colliderRadius;
  }

  getPosition(): Vector3 {
    return this.vehicle.position;
  }

  getVelocity(): Vector3 {
    return this.vehicle.velocity;
  }

  enterVehicle(vehicle: Vehicle): void {
    this.vehicle = vehicle;
  }

  toTargetEntity(): TargetEntity {
    return {
      id: this.id,
      faction: this.faction,
      position: this.vehicle.position.clone(),
      velocity: this.vehicle.velocity.clone(),
      radius: this.vehicle.colliderRadius,
    };
  }

  toSphereBody(): SphereBody {
    return {
      id: this.id,
      position: this.vehicle.position,
      radius: this.vehicle.colliderRadius,
      team: this.vehicle.combatTeam,
      faction: this.faction,
      velocity: this.vehicle.velocity,
    };
  }

  update(context: PlayerActorUpdateContext): void {
    const { input } = context;
    const vehicle = this.vehicle;
    vehicle.applyVehicleInput(context.dt, input.vehicle, context.boundary);
    context.camera.update(context.dt, vehicle.root, input.camera);

    const shipPos = vehicle.root.getAbsolutePosition();
    const shipForward = getShipForward(
      vehicle.root.rotationQuaternion ?? Quaternion.Identity()
    );

    const reticleInner = projectWorldToScreen(
      context.scene,
      shipPos.add(shipForward.scale(RETICLE_INNER_DISTANCE))
    );

    const { debug } = updateWeaponAimForObserver({
      scene: context.scene,
      combat: context.combat,
      weapons: vehicle.weapons,
      observerId: this.id,
      observerFaction: this.faction,
      observerPos: vehicle.position,
      observerVel: vehicle.velocity,
      aimAxis: shipForward,
      candidates: context.hostileTargets,
      targeting: context.targetingConfig,
      radarRadius: context.radarRadius,
      dt: context.dt,
      mode: 'screen',
      targetingSystem: this.targeting,
      reticle: reticleInner,
    });
    this.lastAimDebug = debug;

    const aim = vehicle.getForward();
    if (input.combat.fire) {
      context.combat.tryFirePrimary(
        vehicle.weapons,
        vehicle.combatTeam,
        this.faction,
        this.id,
        aim
      );
    }
    if (input.combat.fireSecondaryPressed) {
      context.combat.tryFireSecondary(
        vehicle.weapons,
        vehicle.combatTeam,
        this.faction,
        this.id,
        aim
      );
    }
  }

  dispose(): void {
    this.vehicle.dispose();
  }
}
