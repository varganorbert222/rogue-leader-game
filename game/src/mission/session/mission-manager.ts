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
import { PlayerActor } from '../../actors/player-actor';
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
import { Vehicle } from '../../vehicles/vehicle';
import { GameAudioBridge } from '../../audio/game-audio-bridge';
import { CollisionSystem } from '../../collision/collision-system';
import { HealthComponent } from '../../actors/health-component';
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
import type { MissionRuntimeContext } from '../simulation/mission-runtime-context';
import { MissionSimulationCoordinator } from '../simulation/coordinator/mission-simulation-coordinator';
import { MissionWorld } from '../simulation/world/mission-world';
import { MissionBootstrap } from '../bootstrap/mission-bootstrap';
import { isDestroyAllEnemiesWon } from '../simulation/systems/wave-spawn-system';
import type { MissionConfig, MissionEndState } from '../mission-types';
import { MissionEndStates } from '../mission-types';
import type { MissionNavigation } from '../../ai/navigation/mission-navigation';

/**
 * Mission session facade: input, HUD, win/lose, and debug API.
 * Loading is delegated to {@link MissionBootstrap}; simulation to {@link MissionSimulationCoordinator}.
 */
export class MissionManager {
  readonly events = new GameEventBus();
  private audioBridge?: GameAudioBridge;
  private config!: MissionConfig;
  private assetManifest!: AssetManifest;
  private shipLoader!: GltfShipLoader;
  private simulation?: MissionSimulationCoordinator;
  private readonly boundInput = new BoundPlayerInput();
  private readonly world = new MissionWorld();
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

  getPlayer(): PlayerActor | undefined {
    return this.world.actors.player;
  }

  getDebugPreferences(): DebugPreferences {
    return cloneDebugPreferences(this.debugPreferences);
  }

  applyDebugPreferences(prefs: DebugPreferences): void {
    this.debugPreferences = cloneDebugPreferences(prefs);
    this.syncDebugStaticMeshes();
  }

  enterPlayerVehicle(vehicle: Vehicle): void {
    this.world.actors.player?.enterVehicle(vehicle);
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
    const playerVehicle = Vehicle.spawn({
      id: 'player',
      shipId: this.config.player.shipId,
      shipEntry,
      loaded: playerLoaded,
      faction: playerFaction,
      combatTeam: 'player',
      weapons: playerWeapons,
      flightDefaults: this.combatConfig.defaults.flight,
    });
    this.world.actors.player = new PlayerActor(
      'player',
      new HealthComponent(100, 100, 50, 50),
      playerVehicle,
      playerFaction,
    );
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
      await this.world.hazards.spawn(
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

    this.syncDebugStaticMeshes(volumeCenter, playerVehicle.root);

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
      player: this.world.actors.player,
      combat: this.combat,
      wavesSpawned: waveState?.wavesSpawned ?? 0,
      config: this.config,
      npcCount: this.world.actors.getNpcCount(),
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
    this.world.actors.player?.vehicle.setFlightAssist(options);
  }

  applyFlightPreferences(prefs: FlightPreferences): void {
    this.world.actors.player?.vehicle.setFlightAssist({ autoRoll: prefs.autoRoll });
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
    const player = this.world.actors.player;
    if (this.endState !== MissionEndStates.Playing || !player || !this.simulation) {
      return;
    }

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
      player,
      playerInput,
      boundary,
      shipLoader: this.shipLoader,
      engineVfx: this.engineVfx,
      wreckDebris: this.wreckDebris,
      prevListenerPosition: this.prevListenerPosition,
    });
    this.prevListenerPosition = tick.prevListenerPosition;

    this.audioBridge?.processInbound(
      this.world.actors.npcActors,
      player.vehicle.position,
      player.faction,
    );
    this.audioBridge?.update(dt, tick.audioContext);
    this.renderGameDebug(player);

    if (!this.debugPreferences.gameplay.invincible && player.health.isDead()) {
      this.endState = MissionEndStates.Lost;
      const entry = this.assetManifest.ships[player.vehicle.shipId];
      if (entry) {
        this.wreckDebris.spawnFromVehicle(
          player.vehicle.shipId,
          entry,
          player.vehicle,
        );
      }
      player.vehicle.root.setEnabled(false);
      ParticleFx.explosion(
        this.host.scene,
        player.vehicle.root.getAbsolutePosition(),
      );
      this.events.emit(GameEvents.missionEnded());
    } else if (
      isDestroyAllEnemiesWon(
        this.config,
        tick.waveState,
        this.world.actors.getNpcCount(),
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
    this.world.hazards.dispose();
    for (const npc of [...this.world.actors.npcActors]) {
      npc.dispose();
    }
    this.world.actors.player?.dispose();
    this.world.actors.clear();
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

  private renderGameDebug(player: PlayerActor): void {
    const prefs = this.debugPreferences;
    if (!hasActiveDebugWork(prefs)) {
      this.gameDebugOverlay.render(this.host.scene, null, prefs);
      return;
    }

    this.gameDebugOverlay.render(
      this.host.scene,
      collectMissionDebugFrame({
        world: this.world,
        player,
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

    const playerRoot = shipRoot ?? this.world.actors.player?.vehicle.root;
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
