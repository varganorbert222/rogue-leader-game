import { Vector3 } from "@babylonjs/core";
import {
  GltfShipLoader,
  LodShipLoader,
  ParticleFx,
  disposeParticleFxPool,
  loadAssetManifest,
  type AssetManifest,
  DebugFloor,
  DebugAxes,
  type BabylonHost,
  type LodLoadProgress,
} from "@rogue-leader/engine";
import { loadCombatConfig, type CombatConfig } from "../data/config/combat-config";
import {
  loadWeaponsManifest,
  type WeaponsManifest,
} from "../data/config/weapons-manifest";
import { ActorWorld } from "../actors/actor-world";
import { PlayerActor } from "../actors/player-actor";
import { MissionNavigation } from "../ai/navigation/mission-navigation";
import { resolveFaction } from "../combat/faction";
import {
  loadNpcBehaviorConfig,
  type NpcBehaviorConfig,
} from "../data/config/npc-behavior-config";
import {
  cloneDebugPreferences,
  loadDebugPreferences,
  type DebugPreferences,
} from "../debug/debug-preferences";
import { GameDebugOverlay } from "../debug/game-debug-overlay";
import {
  hasActiveDebugWork,
} from "../debug/debug-overlay-utils";
import { EngineVfxController } from "../vfx/engine-vfx-controller";
import {
  WreckDebrisManager,
  resolveMissionEnvironment,
} from "../vfx/wreck-debris-manager";
import { MissionAssetPreloader } from "../loading/mission-asset-preloader";
import { Vehicle } from "../vehicles/vehicle";
import {
  GameAudioBridge,
} from "../audio/game-audio-bridge";
import { CollisionSystem } from "../collision/collision-system";
import { HealthComponent } from "../actors/health-component";
import { GameEventBus, GameEvents } from "../events/game-events";
import { CombatTeams } from "../data/constants";
import { WeaponHitSfxResolver } from "../audio/weapon-hit-sfx";
import { CameraController } from "../flight/camera-controller";
import type { FlightAssistOptions } from "../flight/flight-assist";
import { shipRotationFromHeading } from "../flight/ship-forward";
import { AsteroidField } from "../hazards/asteroid-field";
import { BoundPlayerInput } from "../player/input/bound-player-input";
import type { FlightPreferences } from "../player/settings/flight-preferences";
import {
  loadControlBindings,
  saveControlBindings,
  type ControlBindingsConfig,
} from "../player/settings/control-bindings";
import { loadFlightPreferences } from "../player/settings/flight-preferences";
import { CombatSystem } from "../weapons/combat-system";
import { buildMissionAudioContext } from "./mission-audio-context";
import {
  checkAsteroidCollisions,
  collectMissionWeaponSystems,
  collectProjectileTargets,
  handleProjectileHit,
  updateMissionLod,
  type MissionCombatHandlerContext,
} from "./mission-combat-handlers";
import { updateMissionNpcs } from "./mission-npc-update";
import {
  createInitialWaveState,
  isDestroyAllEnemiesWon,
  updateMissionWaves,
  type MissionWaveState,
} from "./mission-wave-runner";
import {
  getMissionList,
  getMissionConfig,
  requireMissionConfig,
} from "./mission-registry";
import {
  buildMissionHudState,
  type MissionHudState,
  type MissionLoadState,
} from "./mission-hud";
import { collectMissionDebugFrame } from "./mission-debug-snapshot";
import type {
  MissionConfig,
  MissionEndState,
} from "./mission-types";
import { MissionEndStates } from "./mission-types";

export class MissionManager {
  readonly events = new GameEventBus();
  private audioBridge?: GameAudioBridge;
  private config!: MissionConfig;
  private assetManifest!: AssetManifest;
  private shipLoader!: GltfShipLoader;
  private readonly boundInput = new BoundPlayerInput();
  private readonly world = new ActorWorld();
  private loadState: MissionLoadState = { loading: false, message: "" };
  private loadProgressCallback?: (progress: LodLoadProgress) => void;
  private camera!: CameraController;
  private combat!: CombatSystem;
  private collision = new CollisionSystem();
  private asteroidField = new AsteroidField();
  private waveState: MissionWaveState = {
    wavesSpawned: 0,
    waveTimer: 0,
    waveSpawnInProgress: false,
  };
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
  private asteroidHitCooldown = 0;
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
    return this.world.player;
  }

  getDebugPreferences(): DebugPreferences {
    return cloneDebugPreferences(this.debugPreferences);
  }

  applyDebugPreferences(prefs: DebugPreferences): void {
    this.debugPreferences = cloneDebugPreferences(prefs);
    this.syncDebugStaticMeshes();
  }

  /** Move the player role into another vehicle (e.g. dock / hijack). */
  enterPlayerVehicle(vehicle: Vehicle): void {
    this.world.player?.enterVehicle(vehicle);
  }

  async load(missionId: string): Promise<void> {
    const config = requireMissionConfig(missionId);
    this.config = config;
    this.assetManifest = await loadAssetManifest("/assets/manifest.json");
    this.wreckDebris.setEnvironment(resolveMissionEnvironment(config));
    this.weaponsManifest = await loadWeaponsManifest(
      "/assets/weapons/manifest.json",
    );
    this.hitSfxResolver = new WeaponHitSfxResolver(this.weaponsManifest);
    this.combatConfig = await loadCombatConfig("/assets/combat.json");
    this.npcBehaviorConfig = await loadNpcBehaviorConfig(
      "/assets/npc-behavior.json",
    );
    this.missionNavigation = new MissionNavigation(config.navigation);
    this.loadState = { loading: true, message: "Loading mission…" };
    const lodLoader = new LodShipLoader(this.host.scene, "/assets");
    this.shipLoader = new GltfShipLoader(this.host.scene, "/assets", lodLoader);
    this.shipLoader.setLodProgressCallback((progress) => {
      this.loadState = { loading: true, message: progress.message };
      this.loadProgressCallback?.(progress);
    });
    this.applyControlBindings(loadControlBindings());
    this.applyFlightPreferences(loadFlightPreferences());
    this.audioBridge = new GameAudioBridge(this.host.audio, this.events);

    await this.assetPreloader.preloadAll({
      config,
      manifest: this.assetManifest,
      weaponsManifest: this.weaponsManifest,
      scene: this.host.scene,
      shipLoader: this.shipLoader,
      wreckDebris: this.wreckDebris,
      audio: this.host.audio,
      onMessage: (message) => {
        this.loadState = { loading: true, message };
      },
    });

    // Initialize combat system and load player ammo
    this.combat = new CombatSystem(this.host.scene, this.events);
    this.combat.setWeaponsManifest(this.weaponsManifest);
    this.combat.initPlayerAmmo(this.combatConfig.playerAmmo);
    this.combat.initTargets(
      () => collectProjectileTargets(this.world, this.asteroidField),
      (hit) => handleProjectileHit(this.combatHandlerContext(), hit),
    );
    this.combat.initProjectilePassBy((weaponId, point, velocity) => {
      this.events.emit(
        GameEvents.projectileWhoosh({
          position: point,
          velocity,
        }),
      );
    });

    const shipEntry = this.assetManifest.ships[config.player.shipId];
    if (!shipEntry) throw new Error(`Missing ship: ${config.player.shipId}`);

    const playerLoaded = this.assetPreloader.shipPool.takePlayerShip(
      config.player.shipId,
    );
    playerLoaded.root.position = Vector3.FromArray(config.player.spawn);
    const heading = Vector3.FromArray(config.player.heading).normalize();
    playerLoaded.root.rotationQuaternion = shipRotationFromHeading(heading);

    const playerFaction = resolveFaction(shipEntry.faction);
    const playerWeapons = this.combat.attachWeapons(
      playerLoaded.root,
      shipEntry,
      "player",
      playerLoaded.anchors,
    );
    const playerVehicle = Vehicle.spawn({
      id: "player",
      shipId: config.player.shipId,
      shipEntry,
      loaded: playerLoaded,
      faction: playerFaction,
      combatTeam: "player",
      weapons: playerWeapons,
      flightDefaults: this.combatConfig.defaults.flight,
    });
    this.world.player = new PlayerActor(
      "player",
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
      config.asteroids &&
      this.assetManifest.props[config.asteroids.prefabId]
    ) {
      await this.asteroidField.spawn(
        this.shipLoader,
        this.assetManifest.props[config.asteroids.prefabId],
        config.asteroids,
        playerLoaded.root.position,
        this.assetPreloader.getAsteroidTemplates(),
      );
    }

    const volumeCenter = Vector3.FromArray(config.playVolume.center);
    this.debugFloor?.dispose();
    this.debugFloor = new DebugFloor(this.host.scene, {
      center: volumeCenter,
      extent: config.playVolume.radius,
      step: 50,
      y: 0,
      boundaryRadius: config.playVolume.softBoundary
        ? config.playVolume.radius
        : undefined,
    });

    this.syncDebugStaticMeshes(volumeCenter, playerVehicle.root);

    if (config.introCinematicSec) {
      this.camera.startIntro(config.introCinematicSec);
    }

    this.waveState = createInitialWaveState(config);

    this.events.emit(
      GameEvents.missionStarted({
        musicId: config.musicId,
        musicSetId: config.musicSetId,
        playerShipId: config.player.shipId,
      }),
    );

    this.loadState = { loading: false, message: "" };
    this.shipLoader.setLodProgressCallback(undefined);
  }

  getEndState(): MissionEndState {
    return this.endState;
  }

  getHudState(): MissionHudState {
    return buildMissionHudState({
      scene: this.host.scene,
      backend: this.host.backend,
      player: this.world.player,
      combat: this.combat,
      wavesSpawned: this.waveState.wavesSpawned,
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
    this.world.player?.vehicle.setFlightAssist(options);
  }

  applyFlightPreferences(prefs: FlightPreferences): void {
    this.world.player?.vehicle.setFlightAssist({ autoRoll: prefs.autoRoll });
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
    const player = this.world.player;
    if (this.endState !== MissionEndStates.Playing || !player) return;

    this.boundInput.update();
    const playerInput = this.boundInput.getPlayerInput();
    const boundary = this.config.playVolume.softBoundary
      ? {
          center: Vector3.FromArray(this.config.playVolume.center),
          radius: this.config.playVolume.radius,
        }
      : undefined;

    player.update({
      dt,
      scene: this.host.scene,
      input: playerInput,
      boundary,
      camera: this.camera,
      combat: this.combat,
      events: this.events,
      targetingConfig: this.combatConfig.targeting,
      radarRadius: this.combatConfig.radar.radius,
      hostileTargets: this.world.collectHostileTargets(player.faction),
    });

    this.combat.updatePassByObserver({
      position: player.vehicle.position,
      team: CombatTeams.Player,
    });
    this.combat.updateWeapons(collectMissionWeaponSystems(this.world), dt);
    updateMissionNpcs(
      {
        scene: this.host.scene,
        world: this.world,
        combat: this.combat,
        combatConfig: this.combatConfig,
        npcBehaviorConfig: this.npcBehaviorConfig,
      },
      dt,
      player,
      boundary,
    );
    this.audioBridge?.processInbound(
      this.world.npcActors,
      player.vehicle.position,
      player.faction,
    );

    if (playerInput.vehicle.boost) {
      this.events.emit(GameEvents.boostStarted());
    }

    updateMissionWaves(
      this.waveState,
      dt,
      this.config,
      this.world.getNpcCount(),
      {
        world: this.world,
        assetManifest: this.assetManifest,
        assetPreloader: this.assetPreloader,
        shipLoader: this.shipLoader,
        combat: this.combat,
        combatConfig: this.combatConfig,
        npcBehaviorConfig: this.npcBehaviorConfig,
        missionNavigation: this.missionNavigation,
      },
    );
    this.asteroidField.update(dt);
    this.asteroidHitCooldown = Math.max(0, this.asteroidHitCooldown - dt);
    this.asteroidHitCooldown = checkAsteroidCollisions(
      this.combatHandlerContext(),
      this.asteroidHitCooldown,
    );
    updateMissionLod(this.host.scene, this.world);
    this.wreckDebris.update(dt);
    this.engineVfx.update();
    const audioFrame = buildMissionAudioContext({
      world: this.world,
      player,
      input: playerInput,
      dt,
      camera: this.camera.getCamera(),
      npcBehaviorConfig: this.npcBehaviorConfig,
      prevListenerPosition: this.prevListenerPosition,
    });
    this.prevListenerPosition = audioFrame.prevListenerPosition;
    this.audioBridge?.update(dt, audioFrame.context);
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
        this.waveState,
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
    this.asteroidField.dispose();
    for (const npc of [...this.world.npcActors]) {
      npc.dispose();
    }
    this.world.player?.dispose();
    this.world.clear();
    this.engineVfx.dispose();
    this.wreckDebris.dispose();
    disposeParticleFxPool(this.host.scene);
    this.assetPreloader.dispose();
    this.assetPreloader = new MissionAssetPreloader();
    this.gameDebugOverlay.dispose();
    this.events.clear();
  }

  private combatHandlerContext(): MissionCombatHandlerContext {
    return {
      host: this.host,
      world: this.world,
      combat: this.combat,
      asteroidField: this.asteroidField,
      collision: this.collision,
      camera: this.camera,
      wreckDebris: this.wreckDebris,
      assetPreloader: this.assetPreloader,
      assetManifest: this.assetManifest,
      weaponsManifest: this.weaponsManifest,
      hitSfxResolver: this.hitSfxResolver,
      events: this.events,
      debugPreferences: this.debugPreferences,
      config: this.config,
    };
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
        asteroidField: this.asteroidField,
      }),
      prefs,
    );
  }

  private syncDebugStaticMeshes(
    volumeCenter?: Vector3,
    shipRoot?: import("@babylonjs/core").TransformNode,
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

    const playerRoot = shipRoot ?? this.world.player?.vehicle.root;
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
