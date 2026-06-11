import type { Scene, Vector3 } from '@babylonjs/core';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
import type { FactionId } from '../combat/faction';
import type { TargetingConfig } from '../config/combat-config';
import type { GameEventBus } from '../events/game-events';
import type { SphereBody } from '../collision/collision-system';
import type { WeaponsManifest } from '../config/weapons-manifest';
import type { CombatTeam } from './core/combat-team';
import { ProjectileManager, type ProjectileHitCallback } from './core/projectile-manager';
import type { ProjectileHit } from './core/projectile';
import { VehicleWeaponSystem } from './core/vehicle-weapon-system';

export type { ProjectileHit };

export class CombatSystem {
  readonly projectiles: ProjectileManager;

  private weaponsManifest?: WeaponsManifest;

  constructor(
    private readonly scene: Scene,
    private readonly events: GameEventBus
  ) {
    this.projectiles = new ProjectileManager(scene);
  }

  setWeaponsManifest(manifest: WeaponsManifest): void {
    this.weaponsManifest = manifest;
  }

  initTargets(provider: () => SphereBody[], onHit: ProjectileHitCallback): void {
    this.projectiles.setTargetProvider(provider);
    this.projectiles.setHitCallback(onHit);
  }

  attachWeapons(
    root: import('@babylonjs/core').TransformNode,
    shipEntry: ShipManifestEntry,
    team: CombatTeam,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    if (!this.weaponsManifest) {
      throw new Error('Weapons manifest not loaded — call setWeaponsManifest first');
    }
    return VehicleWeaponSystem.attach(
      root,
      shipEntry,
      this.weaponsManifest,
      team,
      anchors
    );
  }

  /** @deprecated Use attachWeapons */
  attachPlayer(
    root: import('@babylonjs/core').TransformNode,
    shipEntry: ShipManifestEntry,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    return this.attachWeapons(root, shipEntry, 'player', anchors);
  }

  /** @deprecated Use attachWeapons */
  attachEnemy(
    root: import('@babylonjs/core').TransformNode,
    shipEntry: ShipManifestEntry,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    return this.attachWeapons(root, shipEntry, 'enemy', anchors);
  }

  updateWeapons(weaponSystems: VehicleWeaponSystem[], dt: number): void {
    for (const weapons of weaponSystems) {
      weapons.update(dt);
    }
    this.projectiles.update(dt);
  }

  updateWeaponAim(
    weapons: VehicleWeaponSystem,
    axisOrigin: Vector3,
    axisDirection: Vector3,
    target: { position: Vector3; velocity: Vector3; distance: number } | null,
    shooterVel: Vector3,
    targeting: TargetingConfig,
    dt: number
  ): void {
    weapons.updateWeaponAim(
      axisOrigin,
      axisDirection,
      target,
      shooterVel,
      targeting,
      dt
    );
  }

  /** @deprecated Use updateWeaponAim with explicit VehicleWeaponSystem */
  updatePlayerWeaponAim(
    axisOrigin: Vector3,
    axisDirection: Vector3,
    target: { position: Vector3; velocity: Vector3; distance: number } | null,
    shooterVel: Vector3,
    targeting: TargetingConfig,
    dt: number,
    playerWeapons?: VehicleWeaponSystem
  ): void {
    playerWeapons?.updateWeaponAim(
      axisOrigin,
      axisDirection,
      target,
      shooterVel,
      targeting,
      dt
    );
  }

  /** @deprecated Use updateWeapons */
  update(dt: number, weaponSystems: VehicleWeaponSystem[] = []): void {
    this.updateWeapons(weaponSystems, dt);
  }

  /** @deprecated Use updateWeapons */
  updateEnemyWeapons(enemySystems: VehicleWeaponSystem[], dt: number): void {
    for (const system of enemySystems) {
      system.update(dt);
    }
  }

  tryFirePrimary(
    weapons: VehicleWeaponSystem,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3
  ): boolean {
    const aim = weapons.getPrimaryAimDirection(aimDirection);
    return weapons.tryFirePrimary(
      this.projectiles,
      team,
      faction,
      shooterId,
      aim,
      this.events
    );
  }

  tryFireSecondary(
    weapons: VehicleWeaponSystem,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    aimDirection: Vector3
  ): boolean {
    const aim = weapons.getPrimaryAimDirection(aimDirection);
    return weapons.tryFireSecondary(
      this.projectiles,
      team,
      faction,
      shooterId,
      aim,
      this.events
    );
  }

  tryFireAtTarget(
    weapons: VehicleWeaponSystem,
    team: CombatTeam,
    faction: FactionId,
    shooterId: string,
    targetPosition: Vector3,
    targetVelocity: Vector3,
    shooterVelocity: Vector3,
    targeting: TargetingConfig,
    maxRange = Infinity
  ): boolean {
    return weapons.tryFireAtTarget(
      this.projectiles,
      team,
      faction,
      shooterId,
      targetPosition,
      targetVelocity,
      shooterVelocity,
      this.events,
      targeting,
      maxRange
    );
  }

  /** @deprecated Use tryFirePrimary with explicit VehicleWeaponSystem */
  tryPlayerFirePrimary(
    aimDirection: Vector3,
    faction: FactionId,
    _targeting: TargetingConfig,
    playerWeapons?: VehicleWeaponSystem
  ): boolean {
    if (!playerWeapons) return false;
    return this.tryFirePrimary(playerWeapons, 'player', faction, 'player', aimDirection);
  }

  /** @deprecated Use tryFireSecondary with explicit VehicleWeaponSystem */
  tryPlayerFireSecondary(
    aimDirection: Vector3,
    faction: FactionId,
    _targeting: TargetingConfig,
    playerWeapons?: VehicleWeaponSystem
  ): boolean {
    if (!playerWeapons) return false;
    return this.tryFireSecondary(playerWeapons, 'player', faction, 'player', aimDirection);
  }

  /** @deprecated Use tryFireAtTarget */
  tryEnemyFireAt(
    enemyWeapons: VehicleWeaponSystem,
    faction: FactionId,
    shooterId: string,
    targetPosition: Vector3,
    targetVelocity: Vector3,
    shooterVelocity: Vector3,
    targeting: TargetingConfig,
    maxRange: number
  ): boolean {
    return this.tryFireAtTarget(
      enemyWeapons,
      'enemy',
      faction,
      shooterId,
      targetPosition,
      targetVelocity,
      shooterVelocity,
      targeting,
      maxRange
    );
  }

  getWeaponsManifest(): WeaponsManifest | undefined {
    return this.weaponsManifest;
  }

  dispose(): void {
    this.projectiles.dispose();
  }
}
