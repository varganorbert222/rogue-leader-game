import type { TransformNode, Vector3 } from '@babylonjs/core';
import type { GameEventBus } from '../events/game-events';
import type { WeaponDefinition } from './core/weapon-definition';

/** Future non-projectile weapons implement this contract. */
export interface IWeapon {
  readonly definition: WeaponDefinition;
  update(dt: number): void;
  tryFire(_origin: TransformNode, _direction: Vector3): boolean;
}

export type { WeaponDefinition, ProjectileWeaponDefinition } from './core/weapon-definition';
