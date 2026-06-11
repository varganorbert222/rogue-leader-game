import { Vector3, type TransformNode } from '@babylonjs/core';
import { detectWeaponMounts } from '@rogue-leader/engine';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import type { WeaponsManifest } from '../../config/weapons-manifest';
import type { TargetingConfig } from '../../config/combat-config';
import { isTargetInAimHemisphere } from '../aim-solver';
import type { FactionId } from '../../combat/faction';
import type { CombatTeam } from './combat-team';
import { createMountedWeapons, MountedWeapon } from './mounted-weapon';
import type { ProjectileManager } from './projectile-manager';
import { createMountWeaponBindings } from './weapon-registry';
import type { WeaponFireGroup } from './weapon-definition';
import type { PlayerAmmoStore } from '../player-ammo';

export interface WeaponAimTarget {
  position: Vector3;
  velocity: Vector3;
  distance: number;
}

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

  updateWeaponAim(
    axisOrigin: Vector3,
    axisDirection: Vector3,
    target: WeaponAimTarget | null,
    shooterVel: Vector3,
    targeting: TargetingConfig,
    dt: number
  ): void {
    const maxRad = (targeting.maxDeflectionDeg * Math.PI) / 180;
    const aimSpeedRad = (targeting.weaponAimSpeedDeg * Math.PI) / 180;
    const useAutoAim =
      target != null &&
      target.distance <= targeting.autoAimRange &&
      isTargetInAimHemisphere(axisOrigin, axisDirection, target.position);

    for (const weapon of this.weapons) {
      if (useAutoAim && target) {
        weapon.updateAutoAim(
          axisOrigin,
          axisDirection,
          targeting.convergenceDistance,
          target.position,
          target.velocity,
          shooterVel,
          maxRad,
          dt,
          aimSpeedRad
        );
      } else {
        weapon.updateConvergence(
          axisOrigin,
          axisDirection,
          targeting.convergenceDistance,
          maxRad,
          dt,
          aimSpeedRad
        );
      }
    }
  }

  tryFire(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    group: WeaponFireGroup,
    playerAmmo?: PlayerAmmoStore
  ): boolean {
    let fired = false;
    const dir = aimDirection.clone().normalize();
    for (const weapon of this.weapons) {
      if (!matchesFireGroup(weapon.fireGroup, group)) continue;
      if (group === 'primary' && weapon.definition.delivery !== 'laser') continue;
      if (group === 'secondary' && weapon.definition.delivery !== 'projectile') continue;

      if (
        team === 'player' &&
        weapon.definition.delivery === 'projectile' &&
        playerAmmo &&
        !playerAmmo.canFire(weapon.definition.id)
      ) {
        continue;
      }

      if (weapon.tryFire(projectiles, team, faction, shooterId, dir, events)) {
        fired = true;
        if (
          team === 'player' &&
          weapon.definition.delivery === 'projectile' &&
          playerAmmo
        ) {
          playerAmmo.consume(weapon.definition.id);
        }
      }
    }
    return fired;
  }

  tryFirePrimary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    playerAmmo?: PlayerAmmoStore
  ): boolean {
    return this.tryFire(
      projectiles,
      team,
      faction,
      shooterId,
      aimDirection,
      events,
      'primary',
      playerAmmo
    );
  }

  tryFireSecondary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    playerAmmo?: PlayerAmmoStore
  ): boolean {
    return this.tryFire(
      projectiles,
      team,
      faction,
      shooterId,
      aimDirection,
      events,
      'secondary',
      playerAmmo
    );
  }

  getPrimaryAimDirection(fallback: Vector3): Vector3 {
    const primary = this.weapons.find((w) => matchesFireGroup(w.fireGroup, 'primary'));
    return primary?.getAimDirection(fallback) ?? fallback.clone().normalize();
  }

  tryFireAtTarget(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    targetPosition: Vector3,
    targetVelocity: Vector3,
    shooterVelocity: Vector3,
    events: GameEventBus,
    targeting: TargetingConfig,
    maxRange = Infinity
  ): boolean {
    const origin = this.weapons[0]?.mount.node.getAbsolutePosition();
    if (!origin) return false;
    if (Vector3.Distance(origin, targetPosition) > maxRange) return false;

    const toTarget = targetPosition.subtract(origin).normalize();
    let fired = false;
    for (const weapon of this.weapons) {
      if (!matchesFireGroup(weapon.fireGroup, 'primary')) continue;
      if (weapon.tryFireAtTarget(projectiles, team, faction, shooterId, toTarget, events)) {
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
