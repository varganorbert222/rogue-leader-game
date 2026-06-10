import type { Scene, TransformNode, Vector3 } from '@babylonjs/core';
import type { GameEventBus } from '../events/game-events';
import type { SphereBody } from '../collision/collision-system';
import { ENEMY_LASER_CANNON } from './definitions/enemy-laser-cannon';
import { PLAYER_LASER_CANNON } from './definitions/player-laser-cannon';
import type { CombatTeam } from './core/combat-team';
import { ProjectileManager, type ProjectileHitCallback } from './core/projectile-manager';
import type { ProjectileHit } from './core/projectile';
import { VehicleWeaponSystem } from './core/vehicle-weapon-system';
import type { ProjectileWeaponDefinition } from './core/weapon-definition';

export type { ProjectileHit };

export class CombatSystem {
  readonly projectiles: ProjectileManager;

  private playerWeapons?: VehicleWeaponSystem;

  constructor(
    private readonly scene: Scene,
    private readonly events: GameEventBus
  ) {
    this.projectiles = new ProjectileManager(scene);
  }

  initTargets(provider: () => SphereBody[], onHit: ProjectileHitCallback): void {
    this.projectiles.setTargetProvider(provider);
    this.projectiles.setHitCallback(onHit);
  }

  attachPlayer(
    root: TransformNode,
    loadout: ProjectileWeaponDefinition[] = [PLAYER_LASER_CANNON]
  ): VehicleWeaponSystem {
    this.playerWeapons = VehicleWeaponSystem.attach(root, loadout, 'player');
    return this.playerWeapons;
  }

  attachEnemy(root: TransformNode): VehicleWeaponSystem {
    return VehicleWeaponSystem.attach(root, [ENEMY_LASER_CANNON], 'enemy');
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

  tryPlayerFire(aimDirection: Vector3): boolean {
    if (!this.playerWeapons) return false;
    return this.playerWeapons.tryFirePrimary(
      this.projectiles,
      'player',
      aimDirection,
      this.events
    );
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

  dispose(): void {
    this.projectiles.dispose();
    this.playerWeapons = undefined;
  }
}
