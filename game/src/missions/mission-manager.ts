import { Quaternion, Vector3 } from "@babylonjs/core";
import {
  GltfShipLoader,
  LodShipLoader,
  ParticleFx,
  SkyboxLoader,
  loadAssetManifest,
  type AssetManifest,
  DebugFloor,
  DebugAxes,
  type BabylonHost,
  type LodLoadProgress,
  updateLodByScreenCoverage,
} from "@rogue-leader/engine";
import { loadCombatConfig, type CombatConfig } from "../config/combat-config";
import {
  loadWeaponsManifest,
  type WeaponsManifest,
} from "../config/weapons-manifest";
import { ActorWorld } from "../actors/actor-world";
import { NpcActor } from "../actors/npc-actor";
import { PlayerActor } from "../actors/player-actor";
import { BehaviorNpcInput } from "../ai/behavior-npc-input";
import { computeFlockCenter } from "../ai/boid-forces";
import { MissionNavigation } from "../ai/navigation/mission-navigation";
import { resolveFaction } from "../combat/faction";
import { updateWeaponAimForObserver } from "../combat/weapon-aim-controller";
import {
  loadNpcBehaviorConfig,
  type NpcBehaviorConfig,
} from "../config/npc-behavior-config";
import {
  cloneDebugPreferences,
  loadDebugPreferences,
  type DebugPreferences,
} from "../debug/debug-preferences";
import { GameDebugOverlay } from "../debug/game-debug-overlay";
import { EngineVfxController } from "../vfx/engine-vfx-controller";
import { Vehicle } from "../vehicles/vehicle";
import {
  GameAudioBridge,
  type GameAudioUpdateContext,
  type ShipEngineAudioSource,
} from "../audio/game-audio-bridge";
import type { PlayerInput } from "../input/player-input";
import {
  CollisionSystem,
  type SphereBody,
} from "../collision/collision-system";
import { HealthComponent } from "../entities/health-component";
import { GameEventBus, GameEvents } from "../events/game-events";
import {
  ActorRoles,
  AmmoIds,
  CombatTeams,
  EntityDestroyKinds,
  MissionIds,
  SfxClipIds,
  WinConditionTypes,
} from "../constants";
import { WeaponHitSfxResolver } from "../audio/weapon-hit-sfx";
import { CameraController } from "../flight/camera-controller";
import {
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
} from "../flight/flight-constants";
import type { FlightAssistOptions } from "../flight/flight-assist";
import {
  projectWorldToScreen,
  type HudScreenPoint,
} from "../flight/screen-project";
import {
  getShipForward,
  shipRotationFromHeading,
} from "../flight/ship-forward";
import { MeteorField, type MeteorInstance } from "../hazards/meteor-field";
import { BoundPlayerInput } from "../input/bound-player-input";
import type { FlightPreferences } from "../settings/flight-preferences";
import {
  loadControlBindings,
  saveControlBindings,
  type ControlBindingsConfig,
} from "../settings/control-bindings";
import { loadFlightPreferences } from "../settings/flight-preferences";
import { CombatSystem, type ProjectileHit } from "../weapons/combat-system";
import type { VehicleWeaponSystem } from "../weapons/core/vehicle-weapon-system";
import {
  hudCurrentWave,
  hudTotalWaves,
  missionWaveCount,
  missionWaves,
} from "./mission-waves";
import type {
  MissionConfig,
  MissionEndState,
  MissionWave,
} from "./mission-types";
import { MissionEndStates } from "./mission-types";
import asteroidFieldSpace from "./configs/asteroid-field-space.json";
import mission02 from "./configs/mission-02-hoth-surface.json";
import mission03 from "./configs/mission-03-tatooine.json";

export interface MissionLoadState {
  loading: boolean;
  message: string;
}

export interface MissionHudState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  wave: number;
  totalWaves: number;
  enemiesRemaining: number;
  backend: string;
  laserReady: boolean;
  torpedoesRemaining: number;
  reticleInner: HudScreenPoint;
  reticleOuter: HudScreenPoint;
  targetLock: HudScreenPoint | null;
}

const MISSIONS: Record<string, MissionConfig> = {
  [MissionIds.AsteroidFieldSpace]: asteroidFieldSpace as unknown as MissionConfig,
  [MissionIds.HothSurface]: mission02 as unknown as MissionConfig,
  [MissionIds.Tatooine]: mission03 as unknown as MissionConfig,
};

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
  private meteorField = new MeteorField();
  private wavesSpawned = 0;
  private waveTimer = 0;
  private waveSpawnInProgress = false;
  private endState: MissionEndState = MissionEndStates.Playing;
  private hitSfxResolver?: WeaponHitSfxResolver;
  private weaponsManifest!: WeaponsManifest;
  private combatConfig!: CombatConfig;
  private npcBehaviorConfig!: NpcBehaviorConfig;
  private missionNavigation!: MissionNavigation;
  private debugPreferences: DebugPreferences = loadDebugPreferences();
  private readonly gameDebugOverlay = new GameDebugOverlay();
  private readonly engineVfx = new EngineVfxController();
  private meteorHitCooldown = 0;
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
  }

  static getMissionList(): {
    id: string;
    displayName: string;
    stub: boolean;
    stubMessage?: string;
  }[] {
    return Object.values(MISSIONS).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      stub: !!m.stub,
      stubMessage: m.stubMessage,
    }));
  }

  static getConfig(id: string): MissionConfig | undefined {
    return MISSIONS[id];
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
    const config = MISSIONS[missionId];
    if (!config) throw new Error(`Unknown mission: ${missionId}`);
    if (config.stub)
      throw new Error(config.stubMessage ?? "Mission not available");

    this.config = config;
    this.assetManifest = await loadAssetManifest("/assets/manifest.json");
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

    // Initialize combat system and load player ammo
    this.combat = new CombatSystem(this.host.scene, this.events);
    this.combat.setWeaponsManifest(this.weaponsManifest);
    this.combat.initPlayerAmmo(this.combatConfig.playerAmmo);
    this.combat.initTargets(
      () => this.getProjectileTargets(),
      (hit) => this.handleProjectileHit(hit),
    );
    this.combat.initProjectilePassBy((weaponId, point, velocity) => {
      this.events.emit(
        GameEvents.projectileWhoosh({
          position: point,
          velocity,
        }),
      );
    });

    const sky = this.assetManifest.skyboxes[config.skyboxId];
    if (sky) {
      await SkyboxLoader.apply(this.host.scene, sky, "/assets");
    } else {
      SkyboxLoader.applyFallback(this.host.scene);
    }

    const shipEntry = this.assetManifest.ships[config.player.shipId];
    if (!shipEntry) throw new Error(`Missing ship: ${config.player.shipId}`);

    const playerLoaded = await this.shipLoader.loadShip(
      config.player.shipId,
      shipEntry,
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

    if (config.meteors && this.assetManifest.props[config.meteors.prefabId]) {
      await this.meteorField.spawn(
        this.shipLoader,
        this.assetManifest.props[config.meteors.prefabId],
        config.meteors,
        playerLoaded.root.position,
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

    this.wavesSpawned = 0;
    this.waveSpawnInProgress = false;
    this.waveTimer = missionWaves(config.waves)[0]?.delaySec ?? 0;

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
    const hidden: HudScreenPoint = { xPct: 50, yPct: 50, visible: false };
    let reticleInner = hidden;
    let reticleOuter = hidden;

    const player = this.world.player;
    if (player) {
      const shipPos = player.vehicle.root.getAbsolutePosition();
      const fwd = getShipForward(
        player.vehicle.root.rotationQuaternion ?? Quaternion.Identity(),
      );
      reticleInner = projectWorldToScreen(
        this.host.scene,
        shipPos.add(fwd.scale(RETICLE_INNER_DISTANCE)),
      );
      reticleOuter = projectWorldToScreen(
        this.host.scene,
        shipPos.add(fwd.scale(RETICLE_OUTER_DISTANCE)),
      );
    }

    return {
      health: player?.health.health ?? 0,
      maxHealth: player?.health.maxHealth ?? 100,
      shield: player?.health.shield ?? 0,
      maxShield: player?.health.maxShield ?? 50,
      wave: hudCurrentWave(this.wavesSpawned, this.config?.waves),
      totalWaves: hudTotalWaves(this.config?.waves),
      enemiesRemaining: this.world.getNpcCount(),
      backend: this.host.backend,
      laserReady: true,
      torpedoesRemaining: this.combat
        .getPlayerAmmo()
        .getCount(AmmoIds.ProtonTorpedo),
      reticleInner,
      reticleOuter,
      targetLock: player?.targeting.getActiveTarget()?.screenPoint ?? null,
    };
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
      targetingConfig: this.combatConfig.targeting,
      radarRadius: this.combatConfig.radar.radius,
      hostileTargets: this.world.collectHostileTargets(player.faction),
    });

    this.combat.updatePassByObserver({
      position: player.vehicle.position,
      team: CombatTeams.Player,
    });
    this.combat.updateWeapons(this.collectWeaponSystems(), dt);
    this.updateNpcs(dt, player, boundary);
    this.audioBridge?.processInbound(
      this.world.npcActors,
      player.vehicle.position,
      player.faction,
    );

    if (playerInput.vehicle.boost) {
      this.events.emit(GameEvents.boostStarted());
    }

    this.updateWaves(dt);
    this.meteorField.update(dt);
    this.meteorHitCooldown = Math.max(0, this.meteorHitCooldown - dt);
    this.checkMeteorCollisions();
    this.updateLod();
    this.engineVfx.update();
    this.audioBridge?.update(dt, this.buildAudioContext(player, playerInput, dt));
    this.renderGameDebug(player);

    if (!this.debugPreferences.gameplay.invincible && player.health.isDead()) {
      this.endState = MissionEndStates.Lost;
      ParticleFx.explosion(
        this.host.scene,
        player.vehicle.root.getAbsolutePosition(),
      );
      this.events.emit(GameEvents.missionEnded());
    } else if (this.isDestroyAllEnemiesWon()) {
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
    this.meteorField.dispose();
    for (const npc of [...this.world.npcActors]) {
      npc.dispose();
    }
    this.world.player?.dispose();
    this.world.clear();
    this.engineVfx.dispose();
    this.gameDebugOverlay.dispose();
    this.events.clear();
  }

  private buildAudioContext(
    player: PlayerActor,
    input: PlayerInput,
    dt: number,
  ): GameAudioUpdateContext {
    const playerPos = player.vehicle.position;
    const camera = this.camera.getCamera();
    const listenerPos = camera.position.clone();
    let listenerVelocity = player.vehicle.velocity.clone();

    if (this.prevListenerPosition && dt > 0) {
      listenerVelocity = listenerPos.subtract(this.prevListenerPosition).scale(1 / dt);
    }
    this.prevListenerPosition = listenerPos.clone();

    const radar = this.npcBehaviorConfig.radarRadius;
    const attack = this.npcBehaviorConfig.attackEnterRange;
    let enemiesInRadar = 0;
    let enemiesInAttackRange = 0;

    for (const npc of this.world.npcActors) {
      if (npc.health.isDead()) continue;
      const dist = Vector3.Distance(playerPos, npc.vehicle.position);
      if (dist <= radar) enemiesInRadar++;
      if (dist <= attack) enemiesInAttackRange++;
    }

    return {
      enemyCount: this.world.getNpcCount(),
      enemiesInRadar,
      enemiesInAttackRange,
      playerFiring: input.combat.fire || input.combat.fireSecondaryPressed,
      playerThrottle: input.vehicle.throttle,
      listenerPosition: listenerPos,
      listenerVelocity,
      playerPosition: playerPos.clone(),
      playerVelocity: player.vehicle.velocity.clone(),
      playerSpeedRatio: player.vehicle.getEngineSpeedRatio(),
      npcEngines: this.buildNpcEngineSources(),
    };
  }

  private buildNpcEngineSources(): ShipEngineAudioSource[] {
    const sources: ShipEngineAudioSource[] = [];
    for (const npc of this.world.npcActors) {
      if (npc.health.isDead()) continue;
      sources.push({
        id: npc.id,
        shipId: npc.vehicle.shipId,
        position: npc.vehicle.position.clone(),
        velocity: npc.vehicle.velocity.clone(),
        speedRatio: npc.vehicle.getEngineSpeedRatio(),
      });
    }
    return sources;
  }

  private isDestroyAllEnemiesWon(): boolean {
    if (this.config.winCondition.type !== WinConditionTypes.DestroyAllEnemies) return false;
    const total = missionWaveCount(this.config.waves);
    if (total === 0) return false;
    if (this.waveSpawnInProgress) return false;
    return this.wavesSpawned >= total && this.world.getNpcCount() === 0;
  }

  private updateWaves(dt: number): void {
    const waves = missionWaves(this.config.waves);
    if (this.waveSpawnInProgress || this.wavesSpawned >= waves.length) return;

    const nextWave = waves[this.wavesSpawned];
    if (!nextWave) return;

    const clearanceGated = nextWave.trigger?.endsWith("_cleared") ?? false;
    if (clearanceGated && this.world.getNpcCount() > 0) {
      return;
    }

    if (!clearanceGated && this.waveTimer > 0) {
      this.waveTimer -= dt;
      return;
    }

    if (clearanceGated && this.waveTimer > 0) {
      this.waveTimer -= dt;
    }

    this.waveSpawnInProgress = true;
    void this.spawnWave(nextWave).then(() => {
      this.wavesSpawned++;
      if (this.wavesSpawned < waves.length) {
        this.waveTimer = waves[this.wavesSpawned].delaySec;
      }
      this.waveSpawnInProgress = false;
    });
  }

  private async spawnWave(wave: MissionWave): Promise<void> {
    for (const spec of wave.enemies) {
      const entry = this.assetManifest.ships[spec.shipId];
      if (!entry) continue;
      const loaded = await this.shipLoader.loadShip(spec.shipId, entry);
      loaded.root.position = Vector3.FromArray(spec.spawn);
      const npcId = `enemy_${this.world.getNpcCount()}`;
      const faction = resolveFaction(entry.faction);
      const weapons = this.combat.attachWeapons(
        loaded.root,
        entry,
        "enemy",
        loaded.anchors,
      );
      const vehicle = Vehicle.spawn({
        id: npcId,
        shipId: spec.shipId,
        shipEntry: entry,
        loaded,
        faction,
        combatTeam: "enemy",
        weapons,
        flightDefaults: this.combatConfig.defaults.flight,
      });
      const navKit = this.missionNavigation.createFlockKit(
        wave.id,
        this.npcBehaviorConfig.pathArriveRadius,
        this.npcBehaviorConfig.wanderRetargetRadius,
      );
      const combatRole =
        navKit.combatRole ??
        this.missionNavigation.getFlockAssignment(wave.id)?.combatRole ??
        "hunter";
      this.world.addNpc(
        new NpcActor(
          npcId,
          wave.id,
          new HealthComponent(40, 40, 0, 0),
          vehicle,
          new BehaviorNpcInput(
            this.npcBehaviorConfig,
            navKit,
            spec.behavior,
            combatRole,
          ),
          faction,
        ),
      );
    }
  }

  private collectWeaponSystems(): VehicleWeaponSystem[] {
    const systems = this.world.npcActors.map((npc) => npc.vehicle.weapons);
    if (this.world.player) {
      systems.push(this.world.player.vehicle.weapons);
    }
    return systems;
  }

  private updateNpcs(
    dt: number,
    player: PlayerActor,
    boundary?: { center: Vector3; radius: number },
  ): void {
    const playerPos = player.vehicle.position;
    const playerVel = player.vehicle.velocity;

    const flockMembers = new Map<string, NpcActor[]>();
    for (const npc of this.world.npcActors) {
      const members = flockMembers.get(npc.flockId) ?? [];
      members.push(npc);
      flockMembers.set(npc.flockId, members);
    }

    const flockCenters = new Map<string, Vector3>();
    for (const [flockId, members] of flockMembers) {
      flockCenters.set(
        flockId,
        computeFlockCenter(members.map((npc) => npc.vehicle.position)),
      );
    }

    for (const npc of this.world.npcActors) {
      const flock = flockMembers.get(npc.flockId) ?? [];
      const flockMates = flock
        .filter((mate) => mate.id !== npc.id)
        .map((mate) => ({
          id: mate.id,
          position: mate.vehicle.position,
          velocity: mate.vehicle.velocity,
          radius: mate.vehicle.colliderRadius,
        }));

      const wantsFire = npc.updateSteering({
        dt,
        playerPosition: playerPos,
        playerVelocity: playerVel,
        flockMates,
        flockCenter: flockCenters.get(npc.flockId) ?? npc.vehicle.position,
        boundary,
      });

      const enemyForward = getShipForward(npc.vehicle.rotationQuaternion);
      updateWeaponAimForObserver({
        scene: this.host.scene,
        combat: this.combat,
        weapons: npc.vehicle.weapons,
        observerId: npc.id,
        observerFaction: npc.faction,
        observerPos: npc.vehicle.position,
        observerVel: npc.vehicle.velocity,
        aimAxis: enemyForward,
        candidates: [player.toTargetEntity()],
        targeting: this.combatConfig.targeting,
        radarRadius: this.npcBehaviorConfig.radarRadius,
        dt,
        mode: "radar",
        targetingSystem: npc.targeting,
      });

      if (wantsFire) {
        this.combat.tryFireAtTarget(
          npc.vehicle.weapons,
          npc.vehicle.combatTeam,
          npc.faction,
          npc.id,
          playerPos,
          playerVel,
          npc.vehicle.velocity,
          this.combatConfig.targeting,
          this.npcBehaviorConfig.fireRange,
        );
      }
    }
  }

  private renderGameDebug(player: PlayerActor): void {
    this.gameDebugOverlay.render(
      this.host.scene,
      this.collectDebugFrame(player),
      this.debugPreferences,
    );
  }

  private collectDebugFrame(player: PlayerActor) {
    const vehicles = [];
    if (this.world.player) {
      vehicles.push({
        id: this.world.player.id,
        position: this.world.player.vehicle.position.clone(),
        radius: this.world.player.vehicle.colliderRadius,
        label: this.world.player.vehicle.shipId,
        isPlayer: true,
      });
    }
    for (const npc of this.world.npcActors) {
      vehicles.push({
        id: npc.id,
        position: npc.vehicle.position.clone(),
        radius: npc.vehicle.colliderRadius,
        label: npc.vehicle.shipId,
        isPlayer: false,
      });
    }

    const npcSnapshots = this.world.npcActors
      .map((npc) => {
        const steering = npc.getSteeringDebug();
        if (!steering) return null;
        return {
          id: npc.id,
          flockId: npc.flockId,
          position: npc.vehicle.position.clone(),
          state: steering.state,
          steering,
          radarRadius: this.npcBehaviorConfig.radarRadius,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    return {
      playerAim: player.lastAimDebug ?? undefined,
      paths: this.missionNavigation.listPathPolylines(),
      zones: this.missionNavigation.listZones(),
      npcs: npcSnapshots,
      vehicles,
      projectiles: this.combat.projectiles.getDebugSnapshots(),
      meteors: this.meteorField.meteors.map((meteor) => ({
        id: meteor.id,
        position: meteor.root.position.clone(),
        radius: meteor.colliderRadius,
      })),
    };
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

  private getProjectileTargets(): SphereBody[] {
    const targets = this.world.collectActorSphereBodies();

    for (const meteor of this.meteorField.meteors) {
      targets.push({
        id: meteor.id,
        position: meteor.root.position,
        radius: meteor.colliderRadius,
        team: "neutral",
        faction: "neutral",
      });
    }

    return targets;
  }

  private handleProjectileHit(hit: ProjectileHit): void {
    ParticleFx.hitSpark(this.host.scene, hit.point);
    const hitSfx =
      this.hitSfxResolver?.resolve(hit.weaponId, hit.behavior) ??
      this.weaponsManifest.weapons[hit.weaponId]?.audio?.hit ??
      SfxClipIds.BulletHit;
    this.events.emit(
      GameEvents.projectileHit({
        weaponId: hit.weaponId,
        behavior: hit.behavior,
        sfx: hitSfx,
        position: hit.point.clone(),
      }),
    );

    if (!hit.targetId) return;

    const actor = this.world.findActor(hit.targetId);
    if (actor) {
      if (actor.role === ActorRoles.Player) {
        if (!this.debugPreferences.gameplay.invincible) {
          const result = actor.health.applyDamage(hit.damage);
          const playerPos = actor.vehicle.position.clone();
          if (result.shield > 0) {
            this.events.emit(GameEvents.shieldHit({ position: playerPos }));
          } else {
            this.events.emit(GameEvents.playerDamaged({ position: playerPos }));
          }
        }
        this.camera.shake();
        return;
      }

      actor.health.applyDamage(hit.damage);
      if (actor.health.isDead()) this.destroyNpc(actor as NpcActor);
      return;
    }

    const meteor = this.meteorField.meteors.find((m) => m.id === hit.targetId);
    if (meteor) {
      meteor.health.applyDamage(hit.damage);
      if (meteor.health.isDead()) this.destroyMeteor(meteor);
    }
  }

  private destroyNpc(npc: NpcActor): void {
    ParticleFx.explosion(this.host.scene, npc.vehicle.position);
    this.events.emit(
      GameEvents.entityDestroyed({
        kind: EntityDestroyKinds.Fighter,
        shipId: npc.vehicle.shipId,
        position: npc.vehicle.position.clone(),
      }),
    );
    this.world.removeNpc(npc.id);
    npc.dispose();
  }

  private destroyMeteor(meteor: MeteorInstance): void {
    ParticleFx.explosion(this.host.scene, meteor.root.position);
    this.events.emit(
      GameEvents.entityDestroyed({
        kind: EntityDestroyKinds.Asteroid,
        position: meteor.root.position.clone(),
      }),
    );
    this.meteorField.remove(meteor.id);
  }

  private checkMeteorCollisions(): void {
    const player = this.world.player;
    if (!player || !this.config.meteors) return;
    if (this.meteorHitCooldown > 0) return;
    const playerBody = {
      id: player.id,
      position: player.vehicle.position,
      radius: player.vehicle.colliderRadius,
    };

    for (const meteor of this.meteorField.meteors) {
      const mBody = {
        id: meteor.id,
        position: meteor.root.position,
        radius: meteor.colliderRadius,
      };
      if (this.collision.sphereOverlap(playerBody, mBody)) {
        this.meteorHitCooldown = 1.0;
        if (!this.debugPreferences.gameplay.invincible) {
          const result = player.health.applyDamage(
            this.config.meteors.damageOnImpact,
          );
          const playerPos = player.vehicle.position.clone();
          if (result.shield > 0) {
            this.events.emit(GameEvents.shieldHit({ position: playerPos }));
          } else {
            this.events.emit(GameEvents.playerDamaged({ position: playerPos }));
            this.events.emit(GameEvents.meteorImpact({ position: playerPos }));
          }
        }
        this.camera.shake(0.35);
      }
    }
  }

  private updateLod(): void {
    if (this.world.player) {
      updateLodByScreenCoverage(
        this.host.scene,
        this.world.player.vehicle.lodRuntime,
      );
    }
    for (const npc of this.world.npcActors) {
      updateLodByScreenCoverage(this.host.scene, npc.vehicle.lodRuntime);
    }
  }
}
