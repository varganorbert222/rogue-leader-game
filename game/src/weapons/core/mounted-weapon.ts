import { Vector3 } from '@babylonjs/core';
import type { DetectedWeaponMount } from '@rogue-leader/engine';
import { getMountForward } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import type { CombatTeam } from './combat-team';
import type { ProjectileManager } from './projectile-manager';
import type { ResolvedWeaponDefinition, WeaponFireGroup } from './weapon-definition';

export class MountedWeapon {
  private cooldown = 0;

  constructor(
    public readonly mount: DetectedWeaponMount,
    public readonly definition: ResolvedWeaponDefinition
  ) {}

  get fireGroup(): WeaponFireGroup {
    return this.definition.fireGroup;
  }

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
    events.emit({
      type: 'WeaponFired',
      payload: {
        team,
        weaponId: this.definition.id,
        delivery: this.definition.delivery,
        behavior: this.definition.behavior,
        sfx: this.definition.audio?.fire,
      },
    });

    if (this.definition.behavior === 'missile_homing') {
      events.emit({ type: 'MissileLaunched', payload: { weaponId: this.definition.id } });
    }

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
  bindings: { mount: DetectedWeaponMount; definition: ResolvedWeaponDefinition }[]
): MountedWeapon[] {
  return bindings.map((b) => new MountedWeapon(b.mount, b.definition));
}
