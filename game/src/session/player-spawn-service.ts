import { Vector3 } from '@babylonjs/core';
import {
  prepareLoadedEntityForAcquire,
  prepareLoadedEntityForPool,
  resetLoadedEntityTransform,
  resetShipAnimations,
  RuntimePaths,
  type AssetManifest,
  type BabylonHost,
  type LoadedEntity,
  type ShipManifestEntry,
} from '@rogue-leader/engine';
import { attachPlayerCockpit, disposePlayerCockpit } from '../ecs/services/player-cockpit-service';
import { HealthComponent } from '../ecs/components/health-component';
import { WeaponEnergyComponent } from '../ecs/components/weapon-energy-component';
import { spawnPlayerEntity } from '../ecs/spawn/entity-factory';
import type { World } from '../ecs/world';
import type { CombatSystem } from '../combat/systems/combat-system';
import type { CameraController } from '../flight/camera-controller';
import { shipRotationFromHeading } from '../flight/ship-forward';
import { resolveFaction } from '../combat/faction';
import {
  resolveShipWeaponsConfig,
  resolveShipWeaponEnergyPool,
} from '../config/loaders/ship-weapons-config';
import type { CombatConfig } from '../config/loaders/combat-config';
import type { MissionConfig } from '../mission/mission-types';
import type { MissionAssetPreloader } from '../mission/loading/mission-asset-preloader';
import type { GameEventBus } from '../core/events/game-events';
import { GameEvents } from '../core/events/game-events';

export interface PlayerSpawnServiceDeps {
  host: BabylonHost;
  world: World;
  camera: CameraController;
  combat: CombatSystem;
  assetManifest: AssetManifest;
  assetPreloader: MissionAssetPreloader;
  combatConfig: CombatConfig;
  config: MissionConfig;
  events: GameEventBus;
}

/** Player ship spawn/despawn lifecycle (pool acquire, ECS entity, cockpit). */
export class PlayerSpawnService {
  private missionStartedEmitted = false;
  private activePlayerLoaded?: LoadedEntity;

  constructor(private readonly deps: PlayerSpawnServiceDeps) {}

  getActiveLoadedEntity(): LoadedEntity | undefined {
    return this.activePlayerLoaded;
  }

  resetMissionStartedFlag(): void {
    this.missionStartedEmitted = false;
  }

  async spawn(shipId: string): Promise<void> {
    const shipEntry = this.deps.assetManifest.ships[shipId];
    if (!shipEntry) {
      throw new Error(`Missing ship: ${shipId}`);
    }

    this.deps.config.player.shipId = shipId;

    if (this.deps.world.playerEntity) {
      this.despawn();
    }

    const playerLoaded = this.deps.assetPreloader.shipPool.takePlayerShip(shipId);
    this.activePlayerLoaded = playerLoaded;
    resetLoadedEntityTransform(playerLoaded);
    prepareLoadedEntityForAcquire(playerLoaded);
    playerLoaded.root.position = Vector3.FromArray(this.deps.config.player.spawn);
    const heading = Vector3.FromArray(this.deps.config.player.heading).normalize();
    playerLoaded.root.rotationQuaternion = shipRotationFromHeading(heading);

    const playerFaction = resolveFaction(shipEntry.faction);
    const playerWeapons = this.deps.combat.attachWeapons(
      playerLoaded.root,
      shipEntry,
      'player',
      playerLoaded.anchors,
    );
    const shipGroups = playerWeapons.getShipWeaponGroups();
    this.deps.combat.initPlayerAmmoFromShip(shipEntry, shipGroups);
    const shipWeapons = resolveShipWeaponsConfig(shipEntry);
    const weaponEnergy = new WeaponEnergyComponent(
      resolveShipWeaponEnergyPool(shipWeapons),
      shipGroups.filter((group) => group.usesEnergy),
    );

    spawnPlayerEntity(this.deps.world, {
      id: 'player',
      health: new HealthComponent(100, 100, 50, 50),
      weaponEnergy,
      shipId,
      shipEntry,
      loaded: playerLoaded,
      faction: playerFaction,
      combatTeam: 'player',
      weapons: playerWeapons,
      flightDefaults: this.deps.combatConfig.defaults.flight,
    });

    const playerId = this.deps.world.playerEntity!;
    const cockpit = await attachPlayerCockpit(
      this.deps.world,
      playerId,
      this.deps.host.scene,
      RuntimePaths.assetsBase,
      shipEntry,
    );
    this.deps.camera.setCockpitConfig(cockpit?.config ?? null);
    this.deps.camera.useFollowDriver();

    if (!this.missionStartedEmitted) {
      this.deps.events.emit(
        GameEvents.missionStarted({
          musicId: this.deps.config.musicId,
          musicSetId: this.deps.config.musicSetId,
          playerShipId: shipId,
        }),
      );
      this.missionStartedEmitted = true;
    } else {
      this.deps.events.emit(GameEvents.playerSpawned({ playerShipId: shipId }));
    }
  }

  despawn(): void {
    const playerId = this.deps.world.playerEntity;
    if (!playerId) return;

    this.deps.events.emit(GameEvents.playerDespawned());

    disposePlayerCockpit(this.deps.world, playerId);
    this.deps.camera.setCockpitConfig(null);
    this.deps.camera.useFollowDriver();

    const shipIdentity = this.deps.world.get(playerId, 'shipIdentity');
    const weapons = this.deps.world.get(playerId, 'weapons');
    weapons?.system.setFireEnabled(false);
    this.deps.world.get(playerId, 'sfoil')?.controller.dispose();
    this.deps.world.removeComponent(playerId, 'sfoil');

    const loaded = shipIdentity?.loadedEntity;
    const shipEntry = shipIdentity
      ? this.deps.assetManifest.ships[shipIdentity.shipId]
      : undefined;
    const flight = this.deps.world.get(playerId, 'flight');
    flight?.controller.resetKinematics();
    if (loaded) {
      if (shipEntry) {
        resetShipAnimations(loaded, shipEntry);
      }
      prepareLoadedEntityForPool(loaded);
    }

    this.deps.world.despawn(playerId);

    if (loaded) {
      this.deps.assetPreloader.shipPool.releasePlayerShip(loaded);
    }
    this.activePlayerLoaded = undefined;
  }

  releaseActiveLoaded(): void {
    this.activePlayerLoaded = undefined;
  }
}
