import type { Vector3 } from '@babylonjs/core';
import type { FactionId } from '../combat/faction';
import type { TargetEntity } from '../combat/targeting-system';
import type { SphereBody } from '../collision/collision-system';
import type { HealthComponent } from '../entities/health-component';
import type { Vehicle } from '../vehicles/vehicle';

export type ActorRole = 'player' | 'npc';

/** A character role (player or NPC) occupying a vehicle. */
export interface Actor {
  readonly id: string;
  readonly role: ActorRole;
  readonly faction: FactionId;
  readonly health: HealthComponent;
  vehicle: Vehicle;

  getColliderRadius(): number;
  getPosition(): Vector3;
  getVelocity(): Vector3;
  toTargetEntity(): TargetEntity;
  toSphereBody(): SphereBody;
  dispose(): void;
}
