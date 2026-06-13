import { Vector3 } from '@babylonjs/core';
import type { FactionId } from '../combat/faction';
import { TargetingSystem, type TargetEntity } from '../combat/targeting-system';
import {
  BehaviorNpcInput,
  type NpcSteeringDebugInfo,
} from '../ai/behavior-npc-input';
import { resolveFlockOverlap } from '../ai/boid-forces';
import type { FlockMate } from '../ai/flock-types';
import type { SphereBody } from '../collision/collision-system';
import type { HealthComponent } from '../entities/health-component';
import type { NpcInput } from '../input/npc-input';
import type { SoftBoundary } from '../flight/soft-boundary';
import type { Vehicle } from '../vehicles/vehicle';
import type { Actor, ActorRole } from './actor';

export interface NpcActorUpdateContext {
  dt: number;
  playerPosition: Vector3;
  playerVelocity: Vector3;
  flockMates: FlockMate[];
  flockCenter: Vector3;
  boundary?: SoftBoundary;
}

export class NpcActor implements Actor {
  readonly role: ActorRole = 'npc';
  readonly targeting = new TargetingSystem();

  constructor(
    readonly id: string,
    readonly flockId: string,
    readonly health: HealthComponent,
    public vehicle: Vehicle,
    readonly input: NpcInput,
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

  getSteeringDebug(): NpcSteeringDebugInfo | null {
    if (this.input instanceof BehaviorNpcInput) {
      return this.input.getDebugInfo();
    }
    return null;
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
      colliderMeshes: this.vehicle.colliderMeshes,
    };
  }

  updateSteering(context: NpcActorUpdateContext): boolean {
    const result = this.input.update(context.dt, {
      playerPosition: context.playerPosition,
      flockMates: context.flockMates,
      flockCenter: context.flockCenter,
      vehiclePosition: this.vehicle.position,
      vehicleRotation: this.vehicle.rotationQuaternion,
      vehicleSpeed: this.vehicle.getSpeed(),
      cruiseSpeed: this.vehicle.getCruiseSpeed(),
      vehicleColliderRadius: this.vehicle.colliderRadius,
    });

    this.vehicle.applyVehicleInput(context.dt, result.vehicle, context.boundary);
    resolveFlockOverlap(
      this.vehicle.position,
      this.vehicle.colliderRadius,
      context.flockMates
    );

    return result.wantsFire;
  }

  dispose(): void {
    this.vehicle.dispose();
  }
}
