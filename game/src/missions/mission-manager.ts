import { Quaternion, Vector3 } from '@babylonjs/core';
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
  type LodRuntimeState,
  updateLodByScreenCoverage,
} from '@rogue-leader/engine';
import { loadWeaponsManifest, type WeaponsManifest } from '../config/weapons-manifest';
import { EngineVfxController } from '../vfx/engine-vfx-controller';
import { BoidEnemyAI } from '../ai/boid-enemy-ai';
import { computeFlockCenter } from '../ai/boid-forces';
import { DEBUG_INVINCIBLE, DEBUG_SHOW_AXES } from '../debug-flags';
import { GameAudioBridge } from '../audio/game-audio-bridge';
import { CollisionSystem, type SphereBody } from '../collision/collision-system';
import { HealthComponent } from '../entities/health-component';
import { GameEventBus } from '../events/game-events';
import { CameraController } from '../flight/camera-controller';
import {
  RETICLE_INNER_DISTANCE,
  RETICLE_OUTER_DISTANCE,
} from '../flight/flight-constants';
import type { FlightAssistOptions } from '../flight/flight-assist';
import { PlayerShipController } from '../flight/player-ship-controller';
import { projectWorldToScreen, type HudScreenPoint } from '../flight/screen-project';
import { getShipForward, shipRotationFromHeading } from '../flight/ship-forward';
import { MeteorField, type MeteorInstance } from '../hazards/meteor-field';
import { CombinedInput } from '../input/combined-input';
import { GamepadInput } from '../input/gamepad-input';
import { KeyboardInput } from '../input/keyboard-input';
import type { FlightPreferences } from '../settings/flight-preferences';
import { loadFlightPreferences } from '../settings/flight-preferences';
import { CombatSystem, type ProjectileHit } from '../weapons/combat-system';
import type { VehicleWeaponSystem } from '../weapons/core/vehicle-weapon-system';
import type { MissionConfig, MissionEndState, MissionWave } from './mission-types';
import asteroidFieldSpace from './configs/asteroid-field-space.json';
import mission02 from './configs/mission-02-hoth-surface.json';
import mission03 from './configs/mission-03-tatooine.json';

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
  reticleInner: HudScreenPoint;
  reticleOuter: HudScreenPoint;
}

interface EnemyInstance {
  id: string;
  flockId: string;
  ai: BoidEnemyAI;
  health: HealthComponent;
  radius: number;
  lodRuntime: LodRuntimeState;
  weapons: VehicleWeaponSystem;
}

const MISSIONS: Record<string, MissionConfig> = {
  asteroid_field_space: asteroidFieldSpace as unknown as MissionConfig,
  mission_02_hoth_surface: mission02 as unknown as MissionConfig,
  mission_03_tatooine: mission03 as unknown as MissionConfig,
};

export class MissionManager {
  readonly events = new GameEventBus();
  private audioBridge?: GameAudioBridge;
  private config!: MissionConfig;
  private assetManifest!: AssetManifest;
  private shipLoader!: GltfShipLoader;
  private input!: CombinedInput;
  private readonly gamepadInput = new GamepadInput();
  private playerController?: PlayerShipController;
  private playerHealth?: HealthComponent;
  private playerLodRuntime?: LodRuntimeState;
  private loadState: MissionLoadState = { loading: false, message: '' };
  private loadProgressCallback?: (progress: LodLoadProgress) => void;
  private camera!: CameraController;
  private combat!: CombatSystem;
  private collision = new CollisionSystem();
  private meteorField = new MeteorField();
  private enemies: EnemyInstance[] = [];
  private wavesSpawned = 0;
  private waveTimer = 0;
  private endState: MissionEndState = 'playing';
  private weaponsManifest!: WeaponsManifest;
  private readonly engineVfx = new EngineVfxController();
  private meteorHitCooldown = 0;
  private debugFloor?: DebugFloor;
  private debugWorldAxes?: DebugAxes;
  private debugShipAxes?: DebugAxes;

  constructor(
    private readonly host: BabylonHost,
    private readonly canvas: HTMLCanvasElement
  ) {
    this.camera = new CameraController(host.scene, canvas);
    host.scene.activeCamera = this.camera.getCamera();
  }

  static getMissionList(): { id: string; displayName: string; stub: boolean; stubMessage?: string }[] {
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

  setLoadProgressCallback(callback?: (progress: LodLoadProgress) => void): void {
    this.loadProgressCallback = callback;
  }

  getLoadState(): MissionLoadState {
    return this.loadState;
  }

  async load(missionId: string): Promise<void> {
    const config = MISSIONS[missionId];
    if (!config) throw new Error(`Unknown mission: ${missionId}`);
    if (config.stub) throw new Error(config.stubMessage ?? 'Mission not available');

    this.config = config;
    this.assetManifest = await loadAssetManifest('/assets/manifest.json');
    this.weaponsManifest = await loadWeaponsManifest('/assets/weapons/manifest.json');
    this.loadState = { loading: true, message: 'Loading mission…' };
    const lodLoader = new LodShipLoader(this.host.scene, '/assets');
    this.shipLoader = new GltfShipLoader(this.host.scene, '/assets', lodLoader);
    this.shipLoader.setLodProgressCallback((progress) => {
      this.loadState = { loading: true, message: progress.message };
      this.loadProgressCallback?.(progress);
    });
    this.input = new CombinedInput([new KeyboardInput(), this.gamepadInput]);
    this.applyFlightPreferences(loadFlightPreferences());
    this.audioBridge = new GameAudioBridge(this.host.audio, this.events);

    const sky = this.assetManifest.skyboxes[config.skyboxId];
    if (sky) {
      await SkyboxLoader.apply(this.host.scene, sky, '/assets');
    } else {
      SkyboxLoader.applyFallback(this.host.scene);
    }

    const shipEntry = this.assetManifest.ships[config.player.shipId];
    if (!shipEntry) throw new Error(`Missing ship: ${config.player.shipId}`);

    const playerLoaded = await this.shipLoader.loadShip(config.player.shipId, shipEntry);
    playerLoaded.root.position = Vector3.FromArray(config.player.spawn);
    const heading = Vector3.FromArray(config.player.heading).normalize();
    playerLoaded.root.rotationQuaternion = shipRotationFromHeading(heading);

    this.playerController = new PlayerShipController(
      playerLoaded.root,
      playerLoaded.visualRoot,
      playerLoaded.visual.invertForwardRoll
    );
    this.playerHealth = new HealthComponent(100, 100, 50, 50);
    this.playerLodRuntime = playerLoaded.lodRuntime;

    this.combat = new CombatSystem(this.host.scene, this.events);
    this.combat.setWeaponsManifest(this.weaponsManifest);
    this.combat.initTargets(
      () => this.getProjectileTargets(),
      (hit) => this.handleProjectileHit(hit)
    );
    this.combat.attachPlayer(playerLoaded.root, shipEntry, playerLoaded.anchors);
    this.engineVfx.attach(
      this.host.scene,
      playerLoaded.root,
      shipEntry,
      this.weaponsManifest,
      playerLoaded.anchors
    );

    if (config.meteors && this.assetManifest.props[config.meteors.prefabId]) {
      await this.meteorField.spawn(
        this.shipLoader,
        this.assetManifest.props[config.meteors.prefabId],
        config.meteors,
        playerLoaded.root.position
      );
    }

    const volumeCenter = Vector3.FromArray(config.playVolume.center);
    this.debugFloor?.dispose();
    this.debugFloor = new DebugFloor(this.host.scene, {
      center: volumeCenter,
      extent: config.playVolume.radius,
      step: 50,
      y: 0,
      boundaryRadius: config.playVolume.softBoundary ? config.playVolume.radius : undefined,
    });

    this.debugWorldAxes?.dispose();
    this.debugShipAxes?.dispose();
    if (DEBUG_SHOW_AXES) {
      this.debugWorldAxes = DebugAxes.world(this.host.scene, {
        origin: volumeCenter,
        length: 60,
      });
      this.debugShipAxes = DebugAxes.local(this.host.scene, playerLoaded.root, 14);
    }

    if (config.introCinematicSec) {
      this.camera.startCinematic(config.introCinematicSec);
    }

    this.wavesSpawned = 0;
    this.waveTimer = config.waves[0]?.delaySec ?? 0;

    this.events.emit({
      type: 'MissionStarted',
      payload: { musicId: config.musicId },
    });

    this.loadState = { loading: false, message: '' };
    this.shipLoader.setLodProgressCallback(undefined);
  }

  getEndState(): MissionEndState {
    return this.endState;
  }

  getHudState(): MissionHudState {
    const hidden: HudScreenPoint = { xPct: 50, yPct: 50, visible: false };
    let reticleInner = hidden;
    let reticleOuter = hidden;

    if (this.playerController) {
      const shipPos = this.playerController.root.getAbsolutePosition();
      const fwd = getShipForward(
        this.playerController.root.rotationQuaternion ?? Quaternion.Identity()
      );
      reticleInner = projectWorldToScreen(
        this.host.scene,
        shipPos.add(fwd.scale(RETICLE_INNER_DISTANCE))
      );
      reticleOuter = projectWorldToScreen(
        this.host.scene,
        shipPos.add(fwd.scale(RETICLE_OUTER_DISTANCE))
      );
    }

    return {
      health: this.playerHealth?.health ?? 0,
      maxHealth: this.playerHealth?.maxHealth ?? 100,
      shield: this.playerHealth?.shield ?? 0,
      maxShield: this.playerHealth?.maxShield ?? 50,
      wave: Math.min(this.wavesSpawned, this.config?.waves.length ?? 1),
      totalWaves: this.config?.waves.length ?? 1,
      enemiesRemaining: this.enemies.length,
      backend: this.host.backend,
      laserReady: true,
      reticleInner,
      reticleOuter,
    };
  }

  applyAudioSettings(master: number, music: number, sfx: number, muted: boolean): void {
    this.audioBridge?.applySettings(master, music, sfx, muted);
  }

  applyFlightAssist(options: Partial<FlightAssistOptions>): void {
    this.playerController?.setFlightAssist(options);
  }

  applyFlightPreferences(prefs: FlightPreferences): void {
    this.playerController?.setFlightAssist({ autoRoll: prefs.autoRoll });
    this.gamepadInput.setPreferredGamepadId(prefs.selectedGamepadId, false);
  }

  setPaused(paused: boolean): void {
    if (paused) this.host.audio.duckMusic(0.35);
    else this.host.audio.unduckMusic();
  }

  update(dt: number): void {
    if (this.endState !== 'playing' || !this.playerController || !this.playerHealth) return;

    this.input.update();
    const input = this.input.getFlightInput();
    const boundary = this.config.playVolume.softBoundary
      ? {
          center: Vector3.FromArray(this.config.playVolume.center),
          radius: this.config.playVolume.radius,
        }
      : undefined;

    this.playerController.update(dt, input, boundary);
    this.camera.update(dt, this.playerController.root, input);
    this.combat.update(dt);
    this.combat.updateEnemyWeapons(
      this.enemies.map((e) => e.weapons),
      dt
    );

    const aim = this.playerController.getForward();
    if (input.fire) {
      this.combat.tryPlayerFirePrimary(aim);
    }
    if (input.fireSecondary) {
      this.combat.tryPlayerFireSecondary(aim);
    }
    if (input.boost) {
      this.events.emit({ type: 'BoostStarted' });
    }

    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.meteorField.update(dt);
    this.meteorHitCooldown = Math.max(0, this.meteorHitCooldown - dt);
    this.checkMeteorCollisions();
    this.updateLod();
    this.engineVfx.update();

    if (!DEBUG_INVINCIBLE && this.playerHealth.isDead()) {
      this.endState = 'lost';
      ParticleFx.explosion(this.host.scene, this.playerController.root.getAbsolutePosition());
      this.events.emit({ type: 'MissionEnded' });
    } else if (
      this.config.winCondition.type === 'destroy_all_enemies' &&
      this.wavesSpawned >= this.config.waves.length &&
      this.enemies.length === 0
    ) {
      this.endState = 'won';
      this.events.emit({ type: 'MissionEnded' });
    }
  }

  dispose(): void {
    this.input?.dispose();
    this.combat?.dispose();
    this.debugFloor?.dispose();
    this.debugFloor = undefined;
    this.debugWorldAxes?.dispose();
    this.debugWorldAxes = undefined;
    this.debugShipAxes?.dispose();
    this.debugShipAxes = undefined;
    this.meteorField.dispose();
    this.enemies.forEach((e) => e.ai.root.dispose());
    this.enemies = [];
    this.engineVfx.dispose();
    this.events.clear();
  }

  private updateWaves(dt: number): void {
    if (this.wavesSpawned >= this.config.waves.length) return;

    const nextWave = this.config.waves[this.wavesSpawned];
    if (!nextWave) return;

    if (nextWave.trigger === 'wave_1_cleared' && this.enemies.length > 0) {
      return;
    }

    if (this.waveTimer > 0) {
      this.waveTimer -= dt;
      return;
    }

    void this.spawnWave(nextWave);
    this.wavesSpawned++;
    if (this.wavesSpawned < this.config.waves.length) {
      this.waveTimer = this.config.waves[this.wavesSpawned].delaySec;
    }
  }

  private async spawnWave(wave: MissionWave): Promise<void> {
    for (const spec of wave.enemies) {
      const entry = this.assetManifest.ships[spec.shipId];
      if (!entry) continue;
      const loaded = await this.shipLoader.loadShip(spec.shipId, entry);
      loaded.root.position = Vector3.FromArray(spec.spawn);
      this.enemies.push({
        id: `enemy_${this.enemies.length}`,
        flockId: wave.id,
        ai: new BoidEnemyAI(loaded.root, spec.behavior, entry.colliderRadius),
        health: new HealthComponent(40, 40, 0, 0),
        radius: entry.colliderRadius,
        lodRuntime: loaded.lodRuntime,
        weapons: this.combat.attachEnemy(loaded.root, entry, loaded.anchors),
      });
    }
  }

  private updateEnemies(dt: number): void {
    if (!this.playerController || !this.playerHealth) return;
    const playerPos = this.playerController.root.position;

    const flockMembers = new Map<string, EnemyInstance[]>();
    for (const enemy of this.enemies) {
      const members = flockMembers.get(enemy.flockId) ?? [];
      members.push(enemy);
      flockMembers.set(enemy.flockId, members);
    }

    const flockCenters = new Map<string, Vector3>();
    for (const [flockId, members] of flockMembers) {
      flockCenters.set(
        flockId,
        computeFlockCenter(members.map((enemy) => enemy.ai.root.position))
      );
    }

    for (const enemy of this.enemies) {
      const flock = flockMembers.get(enemy.flockId) ?? [];
      const flockMates = flock
        .filter((mate) => mate.id !== enemy.id)
        .map((mate) => ({
          id: mate.id,
          position: mate.ai.root.position,
          velocity: mate.ai.getVelocity(),
          radius: mate.radius,
        }));

      enemy.ai.update(
        dt,
        {
          playerPos,
          flockMates,
          flockCenter: flockCenters.get(enemy.flockId) ?? enemy.ai.root.position,
        },
        () => {
          this.combat.tryEnemyFireAt(enemy.weapons, playerPos, 140);
        }
      );
    }
  }

  private getProjectileTargets(): SphereBody[] {
    const targets: SphereBody[] = [];

    for (const enemy of this.enemies) {
      targets.push({
        id: enemy.id,
        position: enemy.ai.root.position,
        radius: enemy.radius,
        team: 'enemy',
      });
    }

    for (const meteor of this.meteorField.meteors) {
      targets.push({
        id: meteor.id,
        position: meteor.root.position,
        radius: meteor.colliderRadius,
        team: 'neutral',
      });
    }

    if (this.playerController) {
      targets.push({
        id: 'player',
        position: this.playerController.root.position,
        radius: this.assetManifest.ships[this.config.player.shipId].colliderRadius,
        team: 'player',
      });
    }

    return targets;
  }

  private handleProjectileHit(hit: ProjectileHit): void {
    ParticleFx.hitSpark(this.host.scene, hit.point);
    const hitSfx = this.weaponsManifest.weapons[hit.weaponId]?.audio?.hit ?? 'laser_hit';
    this.events.emit({
      type: 'ProjectileHit',
      payload: { weaponId: hit.weaponId, behavior: hit.behavior, sfx: hitSfx },
    });

    if (hit.team === 'enemy' && hit.targetId === 'player') {
      if (!DEBUG_INVINCIBLE) {
        const result = this.playerHealth!.applyDamage(hit.damage);
        if (result.shield > 0) this.events.emit({ type: 'ShieldHit' });
        else this.events.emit({ type: 'PlayerDamaged' });
      }
      this.camera.shake();
      return;
    }

    if (hit.team !== 'player' || !hit.targetId) return;

    const enemy = this.enemies.find((e) => e.id === hit.targetId);
    if (enemy) {
      enemy.health.applyDamage(hit.damage);
      if (enemy.health.isDead()) this.destroyEnemy(enemy);
      return;
    }

    const meteor = this.meteorField.meteors.find((m) => m.id === hit.targetId);
    if (meteor) {
      meteor.health.applyDamage(hit.damage);
      if (meteor.health.isDead()) this.destroyMeteor(meteor);
    }
  }

  private destroyEnemy(enemy: EnemyInstance): void {
    ParticleFx.explosion(this.host.scene, enemy.ai.root.position);
    this.events.emit({ type: 'EntityDestroyed' });
    enemy.ai.root.dispose();
    this.enemies = this.enemies.filter((e) => e.id !== enemy.id);
  }

  private destroyMeteor(meteor: MeteorInstance): void {
    ParticleFx.explosion(this.host.scene, meteor.root.position);
    this.events.emit({ type: 'EntityDestroyed' });
    this.meteorField.remove(meteor.id);
  }

  private checkMeteorCollisions(): void {
    if (!this.playerController || !this.playerHealth || !this.config.meteors) return;
    if (this.meteorHitCooldown > 0) return;
    const playerBody = {
      id: 'player',
      position: this.playerController.root.position,
      radius: this.assetManifest.ships[this.config.player.shipId].colliderRadius,
    };

    for (const meteor of this.meteorField.meteors) {
      const mBody = {
        id: meteor.id,
        position: meteor.root.position,
        radius: meteor.colliderRadius,
      };
      if (this.collision.sphereOverlap(playerBody, mBody)) {
        this.meteorHitCooldown = 1.0;
        if (!DEBUG_INVINCIBLE) {
          const result = this.playerHealth.applyDamage(this.config.meteors.damageOnImpact);
          if (result.shield > 0) this.events.emit({ type: 'ShieldHit' });
          else {
            this.events.emit({ type: 'PlayerDamaged' });
            this.events.emit({ type: 'MeteorImpact' });
          }
        }
        this.camera.shake(0.35);
      }
    }
  }

  private updateLod(): void {
    if (this.playerLodRuntime) {
      updateLodByScreenCoverage(this.host.scene, this.playerLodRuntime);
    }
    for (const e of this.enemies) {
      updateLodByScreenCoverage(this.host.scene, e.lodRuntime);
    }
  }

}
