import { Vector3, type TransformNode } from '@babylonjs/core';
import { detectWeaponMounts } from '@rogue-leader/engine';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import type { WeaponsManifest } from '../../config/weapons-manifest';
import type { CombatTeam } from './combat-team';
import { createMountedWeapons, MountedWeapon } from './mounted-weapon';
import type { ProjectileManager } from './projectile-manager';
import { createMountWeaponBindings } from './weapon-registry';
import type { WeaponFireGroup } from './weapon-definition';

export class VehicleWeaponSystem {
  private readonly weapons: MountedWeapon[];

  private constructor(weapons: MountedWeapon[]) {
    this.weapons = weapons;
  }

  static attach(
    root: TransformNode,
    shipEntry: ShipManifestEntry,
    weaponsManifest: WeaponsManifest,
    _team: CombatTeam,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    const mounts = detectWeaponMounts(root, anchors);
    const bindings = createMountWeaponBindings(weaponsManifest, shipEntry, mounts);
    const weapons = createMountedWeapons(bindings);
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

  tryFire(
    projectiles: ProjectileManager,
    team: CombatTeam,
    aimDirection: Vector3,
    events: GameEventBus,
    group: WeaponFireGroup
  ): boolean {
    let fired = false;
    const dir = aimDirection.clone().normalize();
    for (const weapon of this.weapons) {
      if (!matchesFireGroup(weapon.fireGroup, group)) continue;
      if (weapon.tryFire(projectiles, team, dir, events)) {
        fired = true;
      }
    }
    return fired;
  }

  tryFirePrimary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    aimDirection: Vector3,
    events: GameEventBus
  ): boolean {
    return this.tryFire(projectiles, team, aimDirection, events, 'primary');
  }

  tryFireSecondary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    aimDirection: Vector3,
    events: GameEventBus
  ): boolean {
    return this.tryFire(projectiles, team, aimDirection, events, 'secondary');
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
      if (!matchesFireGroup(weapon.fireGroup, 'primary')) continue;
      if (weapon.tryFireAtTarget(projectiles, team, targetPosition, events)) {
        fired = true;
      }
    }
    return fired;
  }
}

function matchesFireGroup(weaponGroup: WeaponFireGroup, requested: WeaponFireGroup): boolean {
  if (weaponGroup === 'all') return true;
  return weaponGroup === requested;
}
