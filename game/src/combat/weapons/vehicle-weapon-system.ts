import { Vector3, type TransformNode } from "@babylonjs/core";
import { degToRad, detectWeaponMounts } from "@rogue-leader/engine";
import type { ShipAnchors, ShipManifestEntry } from "@rogue-leader/engine";
import type { GameEventBus } from "../../core/events/game-events";
import type { WeaponsManifest } from "../../data/config/weapons-manifest";
import type { TargetingConfig } from "../../data/config/combat-config";
import {
  resolveShipWeaponGroups,
  resolveGroupFireRateSec,
  mountAssignmentKey,
  type MountGroupAssignment,
  type ResolvedShipWeaponGroup,
} from "../../data/config/ship-weapon-groups";
import { selectMountsForEnergyLevel } from "../../data/config/weapon-firing-pattern";
import { resolveShipWeaponsConfig } from "../../data/config/ship-weapons-config";
import type { WeaponEnergyComponent } from "../../ecs/components/weapon-energy-component";
import { isTargetInAimHemisphere } from "../targeting/aim-solver";
import type { FactionId } from "../faction";
import type { CombatTeam } from "./combat-team";
import { createMountedWeapons, MountedWeapon } from "./mounted-weapon";
import type { ProjectileManager } from "../projectiles/projectile-manager";
import { createMountWeaponBindings } from "./weapon-registry";
import type { WeaponFireGroup } from "./weapon-definition";
import type { PlayerAmmoStore } from "./player-ammo";

export interface WeaponAimTarget {
  position: Vector3;
  velocity: Vector3;
  distance: number;
}

export class VehicleWeaponSystem {
  private readonly weapons: MountedWeapon[];
  private readonly shipGroups: ResolvedShipWeaponGroup[];
  private readonly weaponsByGroup: Map<string, MountedWeapon[]>;
  private fireEnabled = true;

  private constructor(
    weapons: MountedWeapon[],
    shipGroups: ResolvedShipWeaponGroup[],
    assignments: Map<string, MountGroupAssignment>,
  ) {
    this.weapons = weapons;
    this.shipGroups = shipGroups;
    this.weaponsByGroup = buildWeaponsByGroup(weapons, assignments, shipGroups);
    this.resolveGroupFireRates();
  }

  private resolveGroupFireRates(): void {
    for (const group of this.shipGroups) {
      const weapons = this.weaponsByGroup.get(group.id) ?? [];
      group.fireRateSec = resolveGroupFireRateSec(
        weapons,
        group.fireRateSec > 0 ? group.fireRateSec : undefined,
      );
    }
  }

  static attach(
    root: TransformNode,
    shipEntry: ShipManifestEntry,
    weaponsManifest: WeaponsManifest,
    _team: CombatTeam,
    anchors?: ShipAnchors,
  ): VehicleWeaponSystem {
    const mounts = detectWeaponMounts(root, anchors);
    const bindings = createMountWeaponBindings(
      weaponsManifest,
      shipEntry,
      mounts,
    );
    const shipWeapons = resolveShipWeaponsConfig(shipEntry);
    const { groups, assignments } = resolveShipWeaponGroups(
      shipWeapons,
      mounts,
      bindings,
    );
    const weapons = createMountedWeapons(bindings, assignments);
    return new VehicleWeaponSystem(weapons, groups, assignments);
  }

  get mountCount(): number {
    return this.weapons.length;
  }

  getShipWeaponGroups(): ResolvedShipWeaponGroup[] {
    return this.shipGroups;
  }

  setFireEnabled(enabled: boolean): void {
    this.fireEnabled = enabled;
  }

  isFireEnabled(): boolean {
    return this.fireEnabled;
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
    dt: number,
  ): void {
    const maxRad = degToRad(targeting.maxDeflectionDeg);
    const aimSpeedRad = degToRad(targeting.weaponAimSpeedDeg);
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
          aimSpeedRad,
        );
      } else {
        weapon.updateConvergence(
          axisOrigin,
          axisDirection,
          targeting.convergenceDistance,
          maxRad,
          dt,
          aimSpeedRad,
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
    playerAmmo?: PlayerAmmoStore,
    energy?: WeaponEnergyComponent,
  ): boolean {
    if (!this.fireEnabled) return false;
    const dir = aimDirection.clone().normalize();
    const inputGroups = this.shipGroups.filter((g) => g.fireInput === group);
    if (inputGroups.length === 0) return false;

    let fired = false;
    for (const shipGroup of inputGroups) {
      const weapons = this.weaponsByGroup.get(shipGroup.id) ?? [];
      if (weapons.length === 0) continue;

      if (shipGroup.usesEnergy && energy) {
        fired =
          this.tryFireEnergyGroup(
            shipGroup,
            weapons,
            projectiles,
            team,
            faction,
            shooterId,
            dir,
            events,
            playerAmmo,
            energy,
          ) || fired;
      } else if (!shipGroup.usesEnergy) {
        fired =
          this.tryFireProjectileGroup(
            shipGroup,
            weapons,
            projectiles,
            team,
            faction,
            shooterId,
            dir,
            events,
            playerAmmo,
          ) || fired;
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
    playerAmmo?: PlayerAmmoStore,
    energy?: WeaponEnergyComponent,
  ): boolean {
    return this.tryFire(
      projectiles,
      team,
      faction,
      shooterId,
      aimDirection,
      events,
      "primary",
      playerAmmo,
      energy,
    );
  }

  tryFireSecondary(
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    playerAmmo?: PlayerAmmoStore,
    energy?: WeaponEnergyComponent,
  ): boolean {
    return this.tryFire(
      projectiles,
      team,
      faction,
      shooterId,
      aimDirection,
      events,
      "secondary",
      playerAmmo,
      energy,
    );
  }

  getPrimaryAimDirection(fallback: Vector3): Vector3 {
    const primary = this.weapons.find((w) =>
      matchesFireGroup(w.fireGroup, "primary"),
    );
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
    maxRange = Infinity,
  ): boolean {
    if (!this.fireEnabled) return false;
    const origin = this.weapons[0]?.mount.node.getAbsolutePosition();
    if (!origin) return false;
    if (Vector3.Distance(origin, targetPosition) > maxRange) return false;

    const toTarget = targetPosition.subtract(origin).normalize();
    let fired = false;
    for (const weapon of this.weapons) {
      if (!matchesFireGroup(weapon.fireGroup, "primary")) continue;
      if (
        weapon.tryFireAtTarget(
          projectiles,
          team,
          faction,
          shooterId,
          toTarget,
          events,
        )
      ) {
        fired = true;
      }
    }
    return fired;
  }

  private tryFireEnergyGroup(
    shipGroup: ResolvedShipWeaponGroup,
    weapons: MountedWeapon[],
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    playerAmmo: PlayerAmmoStore | undefined,
    energy: WeaponEnergyComponent,
  ): boolean {
    const sorted = sortByGroupOrder(weapons);
    const energyCost = shipGroup.energyCost;

    const ready = sorted.filter(
      (weapon) =>
        weapon.ready &&
        this.canFireWeapon(team, weapon, playerAmmo) &&
        energy.canAffordCost(energyCost),
    );
    if (ready.length === 0) return false;

    const selection = selectMountsForEnergyLevel(sorted, ready, energy, shipGroup);
    const toFire = selection.mounts;
    if (toFire.length === 0) return false;

    let fired = false;
    for (const weapon of toFire) {
      if (!energy.canAffordCost(energyCost)) break;
      if (!weapon.ready || !this.canFireWeapon(team, weapon, playerAmmo))
        continue;
      if (
        weapon.tryFire(
          projectiles,
          team,
          faction,
          shooterId,
          aimDirection,
          events,
        )
      ) {
        energy.consumeCost(energyCost);
        fired = true;
      }
    }

    if (fired && selection.mode !== 'full') {
      energy.scheduleGroupFireCooldown(
        shipGroup.id,
        selection.mode,
        selection.pairCount,
        shipGroup.slotIds.length,
        shipGroup.fireRateSec,
      );
    }

    return fired;
  }

  private tryFireProjectileGroup(
    shipGroup: ResolvedShipWeaponGroup,
    weapons: MountedWeapon[],
    projectiles: ProjectileManager,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3,
    events: GameEventBus,
    playerAmmo?: PlayerAmmoStore,
  ): boolean {
    const sorted = sortByGroupOrder(weapons);
    for (const weapon of sorted) {
      if (!weapon.ready || !this.canFireWeapon(team, weapon, playerAmmo))
        continue;
      if (
        weapon.tryFire(
          projectiles,
          team,
          faction,
          shooterId,
          aimDirection,
          events,
        )
      ) {
        if (team === "player" && playerAmmo) {
          playerAmmo.consume(weapon.definition.id);
        }
        return true;
      }
    }
    return false;
  }

  private canFireWeapon(
    team: CombatTeam,
    weapon: MountedWeapon,
    playerAmmo?: PlayerAmmoStore,
  ): boolean {
    if (
      team === "player" &&
      weapon.definition.delivery === "projectile" &&
      playerAmmo &&
      !playerAmmo.canFire(weapon.definition.id)
    ) {
      return false;
    }
    return true;
  }
}

function matchesFireGroup(
  weaponGroup: WeaponFireGroup,
  requested: WeaponFireGroup,
): boolean {
  if (weaponGroup === "all") return true;
  return weaponGroup === requested;
}

function buildWeaponsByGroup(
  weapons: MountedWeapon[],
  assignments: Map<string, MountGroupAssignment>,
  shipGroups: ResolvedShipWeaponGroup[],
): Map<string, MountedWeapon[]> {
  const map = new Map<string, MountedWeapon[]>();
  for (const group of shipGroups) {
    map.set(group.id, []);
  }
  for (const weapon of weapons) {
    const assignment = assignments.get(mountAssignmentKey(weapon.mount));
    if (!assignment) continue;
    const list = map.get(assignment.groupId);
    if (list) {
      list.push(weapon);
    }
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.indexInGroup - b.indexInGroup);
  }
  return map;
}

function sortByGroupOrder(weapons: MountedWeapon[]): MountedWeapon[] {
  return [...weapons].sort((a, b) => a.indexInGroup - b.indexInGroup);
}
