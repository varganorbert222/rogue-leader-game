import { Vector3 } from '@babylonjs/core';
import type { DetectedWeaponMount } from '@rogue-leader/engine';
import { getMountForward } from '@rogue-leader/engine';
import type { GameEventBus } from '../../events/game-events';
import {
  clampToDeflectionCone,
  computeConvergenceDirection,
  computeLeadDirection,
  isTargetInAimHemisphere,
  rotateTowardDirection,
} from '../aim-solver';
import type { CombatTeam } from './combat-team';
import type { FactionId } from '../../combat/faction';
import type { ProjectileManager } from './projectile-manager';
import type { ResolvedWeaponDefinition, WeaponFireGroup } from './weapon-definition';

export class MountedWeapon {
  private cooldown = 0;
  private aimDirection: Vector3 | null = null;
  private smoothedAimDir: Vector3 | null = null;

  constructor(
    public readonly mount: DetectedWeaponMount,
    public readonly definition: ResolvedWeaponDefinition
  ) {}

  get fireGroup(): WeaponFireGroup {
    return this.definition.fireGroup;
  }

  get projectileSpeed(): number {
    return this.definition.projectile.speed;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get ready(): boolean {
    return this.cooldown <= 0;
  }

  updateConvergence(
    axisOrigin: Vector3,
    axisDirection: Vector3,
    convergenceDistance: number,
    maxDeflectionRad: number,
    dt: number,
    aimSpeedRad: number
  ): void {
    const origin = this.mount.node.getAbsolutePosition();
    const mountForward = getMountForward(this.mount.node);
    const converged = computeConvergenceDirection(
      origin,
      axisOrigin,
      axisDirection,
      convergenceDistance
    );
    const desired = clampToDeflectionCone(mountForward, converged, maxDeflectionRad);
    this.applySmoothedAim(desired, dt, aimSpeedRad);
  }

  updateAutoAim(
    targetPos: Vector3,
    targetVel: Vector3,
    shooterVel: Vector3,
    maxDeflectionRad: number,
    dt: number,
    aimSpeedRad: number
  ): void {
    const origin = this.mount.node.getAbsolutePosition();
    const mountForward = getMountForward(this.mount.node);
    if (!isTargetInAimHemisphere(origin, mountForward, targetPos)) {
      this.applySmoothedAim(mountForward, dt, aimSpeedRad);
      return;
    }

    const leadDir = computeLeadDirection(
      origin,
      targetPos,
      targetVel,
      this.projectileSpeed,
      shooterVel
    );
    const desired = clampToDeflectionCone(mountForward, leadDir, maxDeflectionRad);
    this.applySmoothedAim(desired, dt, aimSpeedRad);
  }

  private getSmoothedAim(): Vector3 {
    if (!this.smoothedAimDir) {
      this.smoothedAimDir = getMountForward(this.mount.node).clone();
    }
    return this.smoothedAimDir;
  }

  private applySmoothedAim(desired: Vector3, dt: number, aimSpeedRad: number): void {
    const current = this.getSmoothedAim();
    const maxStep = aimSpeedRad * dt;
    this.smoothedAimDir = rotateTowardDirection(current, desired, maxStep);
    this.aimDirection = this.smoothedAimDir.clone();
    this.applyGimbalRotation(this.smoothedAimDir);
  }

  private applyGimbalRotation(aimDir: Vector3): void {
    const node = this.mount.node;
    const pos = node.getAbsolutePosition();
    const lookTarget = pos.add(aimDir);
    node.lookAt(lookTarget);
  }

  getAimDirection(fallback: Vector3): Vector3 {
    return (this.aimDirection ?? fallback).clone().normalize();
  }

  tryFire(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
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
    const dir = this.getAimDirection(aimDirection);

    projectiles.spawn({
      origin,
      direction: dir,
      team,
      faction,
      shooterId,
      config: this.definition.projectile,
      damage: this.definition.damage,
      weaponId: this.definition.id,
    });
    return true;
  }

  tryFireAtTarget(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus
  ): boolean {
    return this.tryFire(projectiles, team, faction, shooterId, aimDirection, events);
  }
}

export function createMountedWeapons(
  bindings: { mount: DetectedWeaponMount; definition: ResolvedWeaponDefinition }[]
): MountedWeapon[] {
  return bindings.map((b) => new MountedWeapon(b.mount, b.definition));
}
