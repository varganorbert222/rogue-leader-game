import type { TransformNode } from '@babylonjs/core';
import type { GameEventBus } from '../events/game-events';
import type { IWeapon } from './i-weapon';
import type { StubWeaponDefinition } from './core/weapon-definition';

/** Part B: AT-AT tow cable — stub; mounts use weapon_harpoon_* convention. */
export class HarpoonWeapon implements IWeapon {
  readonly definition: StubWeaponDefinition = {
    id: 'harpoon',
    kind: 'harpoon',
    mountType: 'harpoon',
  };

  constructor(private readonly events: GameEventBus) {}

  update(_dt: number): void {}

  tryFire(_origin: TransformNode): boolean {
    this.events.emit({ type: 'HarpoonAttached' });
    return false;
  }
}
