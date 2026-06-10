import { Vector3, type TransformNode } from '@babylonjs/core';
import { detectWeaponMounts } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import type { CombatTeam } from './combat-team';
import { createMountedWeapons, MountedWeapon } from './mounted-weapon';
import type { ProjectileManager } from './projectile-manager';
import type { ProjectileWeaponDefinition } from './weapon-definition';

export class VehicleWeaponSystem {
  private readonly weapons: MountedWeapon[];

  private constructor(weapons: MountedWeapon[]) {
    this.weapons = weapons;
  }

  static attach(
    root: TransformNode,
    loadout: ProjectileWeaponDefinition[],
    _team: CombatTeam
  ): VehicleWeaponSystem {
    const mounts = detectWeaponMounts(root);
    const weapons = createMountedWeapons(loadout, mounts);
    return new VehicleWeaponSystem(weapons);
  }

  get mountCount(): number {
    return this.weapons.length;
  }

  update(dt: number): void {
    for (const weapon of this.weapons) {
      weapon.update(dt);
    }
  }

  tryFirePrimary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    aimDirection: Vector3,
    events: GameEventBus
  ): boolean {
    let fired = false;
    const dir = aimDirection.clone().normalize();
    for (const weapon of this.weapons) {
      if (weapon.tryFire(projectiles, team, dir, events)) {
        fired = true;
      }
    }
    return fired;
  }

  tryFireAtTarget(
    projectiles: ProjectileManager,
    team: CombatTeam,
    targetPosition: Vector3,
    events: GameEventBus,
    maxRange = Infinity
  ): boolean {
    const origin = this.weapons[0]?.mount.node.getAbsolutePosition();
    if (!origin) return false;
    if (Vector3.Distance(origin, targetPosition) > maxRange) return false;

    let fired = false;
    for (const weapon of this.weapons) {
      if (weapon.tryFireAtTarget(projectiles, team, targetPosition, events)) {
        fired = true;
      }
    }
    return fired;
  }
}
