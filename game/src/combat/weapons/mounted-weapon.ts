import { Vector3 } from "@babylonjs/core";
import type { DetectedWeaponMount } from "@rogue-leader/engine";
import { getMountForward } from "@rogue-leader/engine";
import { GameEvents, type GameEventBus } from '../../core/events/game-events';
import { ProjectileBehaviors } from '../../config/constants/weapon-behaviors';
import {
  clampToDeflectionCone,
  computeConvergenceDirection,
  computeLeadDirection,
  isTargetInAimHemisphere,
  rotateTowardDirection,
} from "../targeting/aim-solver";
import type { CombatTeam } from "./combat-team";
import type { FactionId } from "../faction";
import type { ProjectileManager } from "../projectiles/projectile-manager";
import type {
  ResolvedWeaponDefinition,
  WeaponFireGroup,
} from "./weapon-definition";
import { mountAssignmentKey } from "../../config/loaders/ship-weapon-groups";

export class MountedWeapon {
  private cooldown = 0;
  private aimDirection: Vector3;
  private smoothedAimDir: Vector3;

  constructor(
    public readonly mount: DetectedWeaponMount,
    public readonly definition: ResolvedWeaponDefinition,
    public readonly shipGroupId: string,
    public readonly indexInGroup: number,
  ) {
    // Initialize aim direction to center (mount forward)
    const centerAim = getMountForward(mount.node).clone();
    this.aimDirection = centerAim;
    this.smoothedAimDir = centerAim;
  }

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

  /** Minimum interval between shots for this mount (= definition cooldownSec). */
  get fireRateSec(): number {
    return this.definition.cooldownSec;
  }

  updateConvergence(
    axisOrigin: Vector3,
    axisDirection: Vector3,
    convergenceDistance: number,
    _maxDeflectionRad: number,
    dt: number,
    aimSpeedRad: number,
  ): void {
    const origin = this.mount.node.getAbsolutePosition();
    const restAim = computeConvergenceDirection(
      origin,
      axisOrigin,
      axisDirection,
      convergenceDistance,
    );
    this.applySmoothedAim(restAim, dt, aimSpeedRad);
  }

  updateAutoAim(
    axisOrigin: Vector3,
    axisDirection: Vector3,
    convergenceDistance: number,
    targetPos: Vector3,
    targetVel: Vector3,
    shooterVel: Vector3,
    maxDeflectionRad: number,
    dt: number,
    aimSpeedRad: number,
  ): void {
    const origin = this.mount.node.getAbsolutePosition();
    const restAim = computeConvergenceDirection(
      origin,
      axisOrigin,
      axisDirection,
      convergenceDistance,
    );

    if (!isTargetInAimHemisphere(origin, restAim, targetPos)) {
      this.applySmoothedAim(restAim, dt, aimSpeedRad);
      return;
    }

    const leadDir = computeLeadDirection(
      origin,
      targetPos,
      targetVel,
      this.projectileSpeed,
      shooterVel,
    );
    const desired = clampToDeflectionCone(restAim, leadDir, maxDeflectionRad);
    this.applySmoothedAim(desired, dt, aimSpeedRad);
  }

  private getSmoothedAim(): Vector3 {
    return this.smoothedAimDir;
  }

  private applySmoothedAim(
    desired: Vector3,
    dt: number,
    aimSpeedRad: number,
  ): void {
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

  getAimDirection(_fallback: Vector3): Vector3 {
    return this.aimDirection.clone().normalize();
  }

  tryFire(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
  ): boolean {
    if (!this.ready) return false;

    this.cooldown = this.definition.cooldownSec;
    const origin = this.mount.node.getAbsolutePosition();
    events.emit(
      GameEvents.weaponFired({
        team,
        weaponId: this.definition.id,
        delivery: this.definition.delivery,
        behavior: this.definition.behavior,
        faction,
        sfx: this.definition.audio?.fire,
        position: origin.clone(),
      }),
    );

    if (this.definition.behavior === ProjectileBehaviors.MissileHoming) {
      events.emit(GameEvents.missileLaunched(this.definition.id));
    }

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
    events: GameEventBus,
  ): boolean {
    return this.tryFire(
      projectiles,
      team,
      faction,
      shooterId,
      aimDirection,
      events,
    );
  }
}

export function createMountedWeapons(
  bindings: {
    mount: DetectedWeaponMount;
    definition: ResolvedWeaponDefinition;
  }[],
  assignments: Map<string, { groupId: string; indexInGroup: number }>,
): MountedWeapon[] {
  return bindings.map((b) => {
    const assignment = assignments.get(mountAssignmentKey(b.mount));
    return new MountedWeapon(
      b.mount,
      b.definition,
      assignment?.groupId ?? b.definition.id,
      assignment?.indexInGroup ?? 0,
    );
  });
}
