import type { Scene, TransformNode, Vector3 } from '@babylonjs/core';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
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

  private playerWeapons?: VehicleWeaponSystem;
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

  attachPlayer(
    root: TransformNode,
    shipEntry: ShipManifestEntry,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    if (!this.weaponsManifest) {
      throw new Error('Weapons manifest not loaded — call setWeaponsManifest first');
    }
    this.playerWeapons = VehicleWeaponSystem.attach(
      root,
      shipEntry,
      this.weaponsManifest,
      'player',
      anchors
    );
    return this.playerWeapons;
  }

  attachEnemy(
    root: TransformNode,
    shipEntry: ShipManifestEntry,
    anchors?: ShipAnchors
  ): VehicleWeaponSystem {
    if (!this.weaponsManifest) {
      throw new Error('Weapons manifest not loaded — call setWeaponsManifest first');
    }
    return VehicleWeaponSystem.attach(root, shipEntry, this.weaponsManifest, 'enemy', anchors);
  }

  update(dt: number): void {
    this.playerWeapons?.update(dt);
    this.projectiles.update(dt);
  }

  updateEnemyWeapons(enemySystems: VehicleWeaponSystem[], dt: number): void {
    for (const system of enemySystems) {
      system.update(dt);
    }
  }

  tryPlayerFirePrimary(aimDirection: Vector3): boolean {
    if (!this.playerWeapons) return false;
    return this.playerWeapons.tryFirePrimary(
      this.projectiles,
      'player',
      aimDirection,
      this.events
    );
  }

  tryPlayerFireSecondary(aimDirection: Vector3): boolean {
    if (!this.playerWeapons) return false;
    return this.playerWeapons.tryFireSecondary(
      this.projectiles,
      'player',
      aimDirection,
      this.events
    );
  }

  /** @deprecated Use tryPlayerFirePrimary */
  tryPlayerFire(aimDirection: Vector3): boolean {
    return this.tryPlayerFirePrimary(aimDirection);
  }

  tryEnemyFireAt(
    enemyWeapons: VehicleWeaponSystem,
    targetPosition: Vector3,
    maxRange: number
  ): boolean {
    return enemyWeapons.tryFireAtTarget(
      this.projectiles,
      'enemy',
      targetPosition,
      this.events,
      maxRange
    );
  }

  getWeaponsManifest(): WeaponsManifest | undefined {
    return this.weaponsManifest;
  }

  dispose(): void {
    this.projectiles.dispose();
    this.playerWeapons = undefined;
  }
}
