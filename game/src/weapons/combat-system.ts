import type { Scene, Vector3 } from '@babylonjs/core';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
import type { FactionId } from '../combat/faction';
import type { TargetingConfig } from '../data/config/combat-config';
import type { GameEventBus } from '../events/game-events';
import type { SphereBody } from '../collision/collision-system';
import type { WeaponsManifest } from '../data/config/weapons-manifest';
import type { CombatTeam } from './core/combat-team';
import { ProjectileManager, type ProjectileHitCallback, type ProjectilePassByCallback } from './core/projectile-manager';
import type { ProjectilePassByObserver } from '../audio/projectile-pass-by';
import type { ProjectileHit } from './core/projectile';
import { VehicleWeaponSystem } from './core/vehicle-weapon-system';
import type { PlayerAmmoConfig } from '../data/config/combat-config';
import { PlayerAmmoStore } from './player-ammo';

export type { ProjectileHit };

export class CombatSystem {
  readonly projectiles: ProjectileManager;

  private weaponsManifest?: WeaponsManifest;
  private playerAmmo = new PlayerAmmoStore({});

  constructor(
    private readonly scene: Scene,
    private readonly events: GameEventBus
  ) {
    this.projectiles = new ProjectileManager(scene);
  }

  setWeaponsManifest(manifest: WeaponsManifest): void {
    this.weaponsManifest = manifest;
  }

  initPlayerAmmo(config: PlayerAmmoConfig): void {
    this.playerAmmo = new PlayerAmmoStore(config.magazines);
  }

  getPlayerAmmo(): PlayerAmmoStore {
    return this.playerAmmo;
  }

  initTargets(provider: () => SphereBody[], onHit: ProjectileHitCallback): void {
    this.projectiles.setTargetProvider(provider);
    this.projectiles.setHitCallback(onHit);
  }

  initProjectilePassBy(onPassBy: ProjectilePassByCallback): void {
    this.projectiles.setPassByCallback(onPassBy);
  }

  updatePassByObserver(observer: ProjectilePassByObserver): void {
    this.projectiles.setPassByObserver(observer);
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
      this.events,
      team === 'player' ? this.playerAmmo : undefined
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
      this.events,
      team === 'player' ? this.playerAmmo : undefined
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

  getWeaponsManifest(): WeaponsManifest | undefined {
    return this.weaponsManifest;
  }

  dispose(): void {
    this.projectiles.dispose();
  }
}

