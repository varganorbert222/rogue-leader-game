import type { TransformNode, Vector3 } from '@babylonjs/core';
import type { StubWeaponDefinition } from './weapon-definition';

/** Future non-projectile weapons implement this contract. */
export interface IWeapon {
  readonly definition: StubWeaponDefinition;
  update(dt: number): void;
  tryFire(_origin: TransformNode, _direction: Vector3): boolean;
}

export type { StubWeaponDefinition } from './weapon-definition';
