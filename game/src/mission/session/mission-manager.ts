import { Vector3 } from '@babylonjs/core';
import {
  GltfShipLoader,
  ParticleFx,
  disposeParticleFxPool,
  type AssetManifest,
  DebugFloor,
  DebugAxes,
  type BabylonHost,
  type LodLoadProgress,
} from '@rogue-leader/engine';
import type { CombatConfig } from '../../data/config/combat-config';
import type { WeaponsManifest } from '../../data/config/weapons-manifest';
import type { NpcBehaviorConfig } from '../../data/config/npc-behavior-config';
import {
  cloneDebugPreferences,
  loadDebugPreferences,
  type DebugPreferences,
} from '../../debug/debug-preferences';
import { GameDebugOverlay } from '../../debug/game-debug-overlay';
import { hasActiveDebugWork } from '../../debug/debug-overlay-utils';
import { EngineVfxController } from '../../vfx/engine-vfx-controller';
import {
  WreckDebrisManager,
  resolveMissionEnvironment,
} from '../../vfx/wreck-debris-manager';
import { MissionAssetPreloader } from '../loading/mission-asset-preloader';
import { GameAudioBridge } from '../../audio/game-audio-bridge';
import { CollisionSystem } from '../../collision/collision-system';
import { HealthComponent } from '../../ecs/components/health-component';
import { Role } from '../../ecs/components/role-tag';
import type { EntityId } from '../../ecs/entity-id';
import { spawnPlayerEntity } from '../../ecs/spawn/entity-factory';
import { World } from '../../ecs/world';
import {
  getShipPosition,
  getShipRoot,
  getShipRotation,
  getShipVelocity,
  isShipEntity,
  prepareShipForPool,
  setFlightAssist,
} from '../../ecs/queries/ship-queries';
import { GameEventBus, GameEvents } from '../../core/events/game-events';
import type { WeaponHitSfxResolver } from '../../audio/weapon-hit-sfx';
import { CameraController } from '../../flight/camera-controller';
import type { FlightAssistOptions } from '../../flight/flight-assist';
import { resolveFaction } from '../../combat/faction';
import { shipRotationFromHeading } from '../../flight/ship-forward';
import { BoundPlayerInput } from '../../player/input/bound-player-input';
import type { FlightPreferences } from '../../player/settings/flight-preferences';
import {
  loadControlBindings,
  saveControlBindings,
  type ControlBindingsConfig,
} from '../../player/settings/control-bindings';
import { loadFlightPreferences } from '../../player/settings/flight-preferences';
import { CombatSystem } from '../../combat/systems/combat-system';
import {
  getMissionList,
  getMissionConfig,
} from '../mission-registry';
import {
  buildMissionHudState,
  type MissionHudState,
  type MissionLoadState,
} from '../presentation/mission-hud-state';
import { collectMissionDebugFrame } from '../presentation/mission-debug-snapshot';
import { MissionSimulationCoordinator } from '../simulation/coordinator/mission-simulation-coordinator';
import { MissionBootstrap } from '../bootstrap/mission-bootstrap';
import { isDestroyAllEnemiesWon } from '../simulation/systems/wave-spawn-system';
import type { MissionConfig, MissionEndState } from '../mission-types';
import { MissionEndStates } from '../mission-types';
import type { MissionNavigation } from '../../ai/navigation/mission-navigation';

/**
 * Mission session facade: input, HUD, win/lose, and debug API.
 * Gameplay entities live in the ECS {@link World}.
 */
export class MissionManager {
  readonly events = new GameEventBus();
  private audioBridge?: GameAudioBridge;
  private config!: MissionConfig;
  private assetManifest!: AssetManifest;
  private shipLoader!: GltfShipLoader;
  private simulation?: MissionSimulationCoordinator;
  private readonly boundInput = new BoundPlayerInput();
  private readonly world = new World();
  private loadState: MissionLoadState = { loading: false, message: '' };
  private loadProgressCallback?: (progress: LodLoadProgress) => void;
  private camera!: CameraController;
  private combat!: CombatSystem;
  private readonly collision = new CollisionSystem();
  private endState: MissionEndState = MissionEndStates.Playing;
  private hitSfxResolver?: WeaponHitSfxResolver;
  private weaponsManifest!: WeaponsManifest;
  private combatConfig!: CombatConfig;
  private npcBehaviorConfig!: NpcBehaviorConfig;
  private missionNavigation!: MissionNavigation;
  private debugPreferences: DebugPreferences = loadDebugPreferences();
  private readonly gameDebugOverlay = new GameDebugOverlay();
  private readonly engineVfx = new EngineVfxController();
  private wreckDebris!: WreckDebrisManager;
  private assetPreloader = new MissionAssetPreloader();
  private prevListenerPosition: Vector3 | null = null;
  private debugFloor?: DebugFloor;
  private debugWorldAxes?: DebugAxes;
  private debugShipAxes?: DebugAxes;

  constructor(
    private readonly host: BabylonHost,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.camera = new CameraController(host.scene, canvas);
    host.scene.activeCamera = this.camera.getCamera();
    this.wreckDebris = new WreckDebrisManager(host.scene);
  }

  static getMissionList() {
    return getMissionList();
  }

  static getConfig(id: string): MissionConfig | undefined {
    return getMissionConfig(id);
  }

  setLoadProgressCallback(
    callback?: (progress: LodLoadProgress) => void,
  ): void {
    this.loadProgressCallback = callback;
  }

  getLoadState(): MissionLoadState {
    return this.loadState;
  }

  getPlayerEntity(): EntityId | undefined {
    return this.world.playerEntity;
  }

  getDebugPreferences(): DebugPreferences {
    return cloneDebugPreferences(this.debugPreferences);
  }

  applyDebugPreferences(prefs: DebugPreferences): void {
    this.debugPreferences = cloneDebugPreferences(prefs);
    this.syncDebugStaticMeshes();
  }

  async load(missionId: string): Promise<void> {
    this.loadState = { loading: true, message: 'Loading mission…' };
    this.applyControlBindings(loadControlBindings());
    this.applyFlightPreferences(loadFlightPreferences());
    this.audioBridge = new GameAudioBridge(this.host.audio, this.events);

    const bootstrap = await MissionBootstrap.run({
      host: this.host,
      missionId,
      world: this.world,
      collision: this.collision,
      camera: this.camera,
      events: this.events,
      wreckDebris: this.wreckDebris,
      debugPreferences: this.debugPreferences,
      onLoadMessage: (message) => {
        this.loadState = { loading: true, message };
      },
      onLoadProgress: (progress) => {
        this.loadState = { loading: true, message: progress.message };
        this.loadProgressCallback?.(progress);
      },
    });

    this.config = bootstrap.config;
    this.assetManifest = bootstrap.assetManifest;
    this.weaponsManifest = bootstrap.weaponsManifest;
    this.combatConfig = bootstrap.combatConfig;
    this.npcBehaviorConfig = bootstrap.npcBehaviorConfig;
    this.missionNavigation = bootstrap.missionNavigation;
    this.shipLoader = bootstrap.shipLoader;
    this.combat = bootstrap.combat;
    this.hitSfxResolver = bootstrap.hitSfxResolver;
    this.assetPreloader = bootstrap.assetPreloader;
    this.simulation = bootstrap.simulation;
    this.wreckDebris.setEnvironment(resolveMissionEnvironment(this.config));

    const shipEntry = this.assetManifest.ships[this.config.player.shipId];
    if (!shipEntry) {
      throw new Error(`Missing ship: ${this.config.player.shipId}`);
    }

    const playerLoaded = this.assetPreloader.shipPool.takePlayerShip(
      this.config.player.shipId,
    );
    playerLoaded.root.position = Vector3.FromArray(this.config.player.spawn);
    const heading = Vector3.FromArray(this.config.player.heading).normalize();
    playerLoaded.root.rotationQuaternion = shipRotationFromHeading(heading);

    const playerFaction = resolveFaction(shipEntry.faction);
    const playerWeapons = this.combat.attachWeapons(
      playerLoaded.root,
      shipEntry,
      'player',
      playerLoaded.anchors,
    );
    spawnPlayerEntity(this.world, {
      id: 'player',
      health: new HealthComponent(100, 100, 50, 50),
      shipId: this.config.player.shipId,
      shipEntry,
      loaded: playerLoaded,
      faction: playerFaction,
      combatTeam: 'player',
      weapons: playerWeapons,
      flightDefaults: this.combatConfig.defaults.flight,
    });
    this.engineVfx.attach(
      this.host.scene,
      playerLoaded.root,
      shipEntry,
      this.weaponsManifest,
      playerLoaded.anchors,
    );

    if (
      this.config.asteroids &&
      this.assetManifest.props[this.config.asteroids.prefabId]
    ) {
      await this.world.asteroids.spawnIntoWorld(
        this.world,
        this.shipLoader,
        this.assetManifest.props[this.config.asteroids.prefabId],
        this.config.asteroids,
        playerLoaded.root.position,
        this.assetPreloader.getAsteroidTemplates(),
      );
    }

    const volumeCenter = Vector3.FromArray(this.config.playVolume.center);
    this.debugFloor?.dispose();
    this.debugFloor = new DebugFloor(this.host.scene, {
      center: volumeCenter,
      extent: this.config.playVolume.radius,
      step: 50,
      y: 0,
      boundaryRadius: this.config.playVolume.softBoundary
        ? this.config.playVolume.radius
        : undefined,
    });

    this.syncDebugStaticMeshes(volumeCenter, playerLoaded.root);

    if (this.config.introCinematicSec) {
      this.camera.startIntro(this.config.introCinematicSec);
    }

    this.events.emit(
      GameEvents.missionStarted({
        musicId: this.config.musicId,
        musicSetId: this.config.musicSetId,
        playerShipId: this.config.player.shipId,
      }),
    );

    this.loadState = { loading: false, message: '' };
  }

  getEndState(): MissionEndState {
    return this.endState;
  }

  getHudState(): MissionHudState {
    const waveState = this.simulation?.getWaveState();
    return buildMissionHudState({
      scene: this.host.scene,
      backend: this.host.backend,
      world: this.world,
      playerId: this.world.playerEntity,
      combat: this.combat,
      wavesSpawned: waveState?.wavesSpawned ?? 0,
      config: this.config,
      npcCount: this.world.getNpcCount(),
    });
  }

  applyAudioSettings(
    master: number,
    music: number,
    sfx: number,
    muted: boolean,
  ): void {
    this.host.audio.setMasterVolume(master);
    this.host.audio.setMusicVolume(music);
    this.host.audio.setSfxVolume(sfx);
    this.host.audio.setMuted(muted);
  }

  applyFlightAssist(options: Partial<FlightAssistOptions>): void {
    const playerId = this.world.playerEntity;
    if (!playerId) return;
    setFlightAssist(this.world, playerId, options);
  }

  applyFlightPreferences(prefs: FlightPreferences): void {
    const playerId = this.world.playerEntity;
    if (playerId) {
      setFlightAssist(this.world, playerId, {
        autoRoll: prefs.autoRoll,
      });
    }
    const config = this.boundInput.getConfig();
    config.gamepad.selectedGamepadId = prefs.selectedGamepadId;
    this.boundInput.setConfig(config);
  }

  applyControlBindings(config: ControlBindingsConfig): void {
    const saved = saveControlBindings(config);
    this.boundInput.setConfig(saved);
  }

  setPaused(paused: boolean): void {
    if (paused) this.host.audio.duckMusic(0.35);
    else this.host.audio.unduckMusic();
  }

  update(dt: number): void {
    const playerId = this.world.playerEntity;
    if (this.endState !== MissionEndStates.Playing || !playerId || !this.simulation) {
      return;
    }

    const playerHealth = this.world.get(playerId, 'health');
    const playerFaction = this.world.get(playerId, 'faction');
    const shipIdentity = this.world.get(playerId, 'shipIdentity');
    if (
      !playerHealth ||
      playerFaction === undefined ||
      !shipIdentity ||
      !this.world.has(playerId, 'flight')
    ) {
      return;
    }

    const playerRoot = getShipRoot(this.world, playerId);

    this.boundInput.update();
    const playerInput = this.boundInput.getPlayerInput();
    const boundary = this.config.playVolume.softBoundary
      ? {
          center: Vector3.FromArray(this.config.playVolume.center),
          radius: this.config.playVolume.radius,
        }
      : undefined;

    const tick = this.simulation.tick({
      dt,
      playerId,
      playerInput,
      boundary,
      shipLoader: this.shipLoader,
      engineVfx: this.engineVfx,
      wreckDebris: this.wreckDebris,
      prevListenerPosition: this.prevListenerPosition,
    });
    this.prevListenerPosition = tick.prevListenerPosition;

    this.audioBridge?.update(dt, tick.audioContext);
    this.audioBridge?.processInbound(
      this.world,
      tick.audioContext.listenerPosition,
      playerFaction,
    );
    this.renderGameDebug(playerId);

    if (!this.debugPreferences.gameplay.invincible && playerHealth.isDead()) {
      this.endState = MissionEndStates.Lost;
      const entry = this.assetManifest.ships[shipIdentity.shipId];
      if (entry) {
        this.wreckDebris.spawnFromShip(
          shipIdentity.shipId,
          entry,
          {
            position: getShipPosition(this.world, playerId).clone(),
            rotationQuaternion: getShipRotation(this.world, playerId).clone(),
            velocity: getShipVelocity(this.world, playerId).clone(),
          },
        );
      }
      playerRoot.setEnabled(false);
      ParticleFx.explosion(
        this.host.scene,
        playerRoot.getAbsolutePosition(),
      );
      this.events.emit(GameEvents.missionEnded());
    } else if (
      isDestroyAllEnemiesWon(
        this.config,
        tick.waveState,
        this.world.getNpcCount(),
      )
    ) {
      this.endState = MissionEndStates.Won;
      this.events.emit(GameEvents.missionEnded());
    }
  }

  dispose(): void {
    this.boundInput.dispose();
    this.combat?.dispose();
    this.debugFloor?.dispose();
    this.debugFloor = undefined;
    this.debugWorldAxes?.dispose();
    this.debugWorldAxes = undefined;
    this.debugShipAxes?.dispose();
    this.debugShipAxes = undefined;

    for (const id of [...this.world.allEntities()]) {
      const role = this.world.get(id, 'role');
      if (role === Role.Npc && isShipEntity(this.world, id)) {
        prepareShipForPool(this.world, id);
      }
      if (isShipEntity(this.world, id)) {
        this.world.get(id, 'sfoil')?.controller.dispose();
        getShipRoot(this.world, id).dispose();
      }
    }
    this.world.dispose();

    this.engineVfx.dispose();
    this.wreckDebris.dispose();
    disposeParticleFxPool(this.host.scene);
    this.assetPreloader.dispose();
    this.assetPreloader = new MissionAssetPreloader();
    this.gameDebugOverlay.dispose();
    this.events.clear();
    this.simulation = undefined;
    this.prevListenerPosition = null;
  }

  private renderGameDebug(playerId: EntityId): void {
    const prefs = this.debugPreferences;
    if (!hasActiveDebugWork(prefs)) {
      this.gameDebugOverlay.render(this.host.scene, null, prefs);
      return;
    }

    this.gameDebugOverlay.render(
      this.host.scene,
      collectMissionDebugFrame({
        world: this.world,
        playerId,
        prefs,
        missionNavigation: this.missionNavigation,
        npcBehaviorConfig: this.npcBehaviorConfig,
        combat: this.combat,
      }),
      prefs,
    );
  }

  private syncDebugStaticMeshes(
    volumeCenter?: Vector3,
    shipRoot?: import('@babylonjs/core').TransformNode,
  ): void {
    const prefs = this.debugPreferences;
    const enabled = prefs.masterEnabled;
    const center =
      volumeCenter ??
      Vector3.FromArray(this.config?.playVolume.center ?? [0, 0, 0]);

    this.debugFloor?.setEnabled(enabled && prefs.overlays.playVolumeGrid);

    if (enabled && prefs.overlays.worldAxes) {
      if (!this.debugWorldAxes) {
        this.debugWorldAxes = DebugAxes.world(this.host.scene, {
          origin: center,
          length: 60,
        });
      }
      this.debugWorldAxes.setEnabled(true);
    } else {
      this.debugWorldAxes?.setEnabled(false);
    }

    const playerRoot =
      shipRoot ??
      (this.world.playerEntity
        ? getShipRoot(this.world, this.world.playerEntity)
        : undefined);
    if (enabled && prefs.overlays.shipAxes && playerRoot) {
      if (!this.debugShipAxes) {
        this.debugShipAxes = DebugAxes.local(this.host.scene, playerRoot, 14);
      }
      this.debugShipAxes.setEnabled(true);
    } else {
      this.debugShipAxes?.setEnabled(false);
    }
  }
}
