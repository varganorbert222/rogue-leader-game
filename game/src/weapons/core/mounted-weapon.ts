import { Vector3 } from '@babylonjs/core';
import type { DetectedWeaponMount } from '@rogue-leader/engine';
import { getMountForward } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import type { CombatTeam } from './combat-team';
import type { ProjectileManager } from './projectile-manager';
import type { ProjectileWeaponDefinition } from './weapon-definition';

export class MountedWeapon {
  private cooldown = 0;

  constructor(
    public readonly mount: DetectedWeaponMount,
    public readonly definition: ProjectileWeaponDefinition
  ) {}

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get ready(): boolean {
    return this.cooldown <= 0;
  }

  tryFire(
    projectiles: ProjectileManager,
    team: CombatTeam,
    aimDirection: Vector3,
    events: GameEventBus
  ): boolean {
    if (!this.ready) return false;

    this.cooldown = this.definition.cooldownSec;
    events.emit({ type: 'WeaponFired', payload: { team } });

    const origin = this.mount.node.getAbsolutePosition();
    const mountForward = getMountForward(this.mount.node);
    const dir =
      Vector3.Dot(mountForward, aimDirection) > 0.25
        ? mountForward
        : aimDirection.clone().normalize();

    projectiles.spawn({
      origin,
      direction: dir,
      team,
      config: this.definition.projectile,
      damage: this.definition.damage,
      weaponId: this.definition.id,
    });
    return true;
  }

  tryFireAtTarget(
    projectiles: ProjectileManager,
    team: CombatTeam,
    targetPosition: Vector3,
    events: GameEventBus
  ): boolean {
    const origin = this.mount.node.getAbsolutePosition();
    const toTarget = targetPosition.subtract(origin);
    if (toTarget.lengthSquared() < 1e-4) return false;
    return this.tryFire(projectiles, team, toTarget.normalize(), events);
  }
}

export function createMountedWeapons(
  definitions: ProjectileWeaponDefinition[],
  mounts: DetectedWeaponMount[]
): MountedWeapon[] {
  const weapons: MountedWeapon[] = [];

  for (const def of definitions) {
    const matching = mounts.filter((m) => m.weaponType === def.mountType);
    if (matching.length === 0) continue;

    for (const mount of matching) {
      weapons.push(new MountedWeapon(mount, def));
    }
  }

  return weapons;
}
