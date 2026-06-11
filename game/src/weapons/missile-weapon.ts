import type { TransformNode } from '@babylonjs/core';
import { GameEvents, type GameEventBus } from '../events/game-events';
import type { IWeapon } from './i-weapon';
import type { StubWeaponDefinition } from './core/weapon-definition';

/** Part B: lock-on missiles — stub; mounts use weapon_missile_* convention. */
export class MissileWeapon implements IWeapon {
  readonly definition: StubWeaponDefinition = {
    id: 'missile',
    kind: 'missile',
    mountType: 'missile',
  };

  constructor(private readonly events: GameEventBus) {}

  update(_dt: number): void {}

  tryFire(_origin: TransformNode): boolean {
    this.events.emit(GameEvents.missileLaunched(this.definition.id));
    return false;
  }
}
