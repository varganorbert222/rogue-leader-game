import { Vector3 } from '@babylonjs/core';
import { CombatTeams } from '../../../data/constants';
import { GameEvents } from '../../../core/events/game-events';
import type { PlayerActor } from '../../../actors/player-actor';
import type { PlayerInput } from '../../../player/input/player-input';
import type { EngineVfxController } from '../../../vfx/engine-vfx-controller';
import type { WreckDebrisManager } from '../../../vfx/wreck-debris-manager';
import type { GameAudioUpdateContext } from '../../../audio/game-audio-bridge';
import type { GltfShipLoader } from '@rogue-leader/engine';
import { buildMissionAudioContext } from '../services/mission-audio-context';
import type { MissionRuntimeContext } from '../mission-runtime-context';
import { resolveProjectileHit } from '../systems/damage-resolution-system';
import { updatePlayerAsteroidCollisions } from '../systems/hazard-collision-system';
import { updateMissionLodStates } from '../systems/lod-update-system';
import { updateNpcSimulation } from '../systems/npc-simulation-system';
import {
  createInitialWaveState,
  updateWaveSpawning,
  type WaveSpawnState,
} from '../systems/wave-spawn-system';

export interface MissionSimulationTickInput {
  dt: number;
  player: PlayerActor;
  playerInput: PlayerInput;
  boundary?: { center: Vector3; radius: number };
  shipLoader: GltfShipLoader;
  engineVfx: EngineVfxController;
  wreckDebris: WreckDebrisManager;
  prevListenerPosition: Vector3 | null;
}

export interface MissionSimulationTickResult {
  waveState: WaveSpawnState;
  audioContext: GameAudioUpdateContext;
  prevListenerPosition: Vector3;
}

/** Fixed-order per-frame mission simulation tick. */
export class MissionSimulationCoordinator {
  private waveState: WaveSpawnState;
  private asteroidHitCooldown = 0;

  constructor(
    private readonly runtime: MissionRuntimeContext,
    waveState?: WaveSpawnState,
  ) {
    this.waveState =
      waveState ?? createInitialWaveState(runtime.config);
  }

  getWaveState(): WaveSpawnState {
    return this.waveState;
  }

  resetWaveState(config = this.runtime.config): void {
    this.waveState = createInitialWaveState(config);
    this.asteroidHitCooldown = 0;
  }

  wireCombatTargets(): void {
    this.runtime.combat.initTargets(
      () => this.runtime.world.collectProjectileTargetBodies(),
      (hit) => resolveProjectileHit(this.runtime, hit),
    );
  }

  tick(input: MissionSimulationTickInput): MissionSimulationTickResult {
    const { dt, player, playerInput, boundary, shipLoader, engineVfx, wreckDebris } =
      input;
    const { world } = this.runtime;

    player.update({
      dt,
      scene: this.runtime.host.scene,
      input: playerInput,
      boundary,
      camera: this.runtime.camera,
      combat: this.runtime.combat,
      events: this.runtime.events,
      targetingConfig: this.runtime.combatConfig.targeting,
      radarRadius: this.runtime.combatConfig.radar.radius,
      hostileTargets: world.actors.collectHostileTargets(player.faction),
    });

    this.runtime.combat.updatePassByObserver({
      position: player.vehicle.position,
      team: CombatTeams.Player,
    });
    this.runtime.combat.updateWeapons(
      world.collectVehicleWeaponSystems(),
      dt,
    );

    updateNpcSimulation(
      {
        scene: this.runtime.host.scene,
        actors: world.actors,
        combat: this.runtime.combat,
        combatConfig: this.runtime.combatConfig,
        npcBehaviorConfig: this.runtime.npcBehaviorConfig,
      },
      dt,
      player,
      boundary,
    );

    if (playerInput.vehicle.boost) {
      this.runtime.events.emit(GameEvents.boostStarted());
    }

    updateWaveSpawning(
      this.waveState,
      dt,
      this.runtime.config,
      world.actors.getNpcCount(),
      {
        actors: world.actors,
        assetManifest: this.runtime.assetManifest,
        assetPreloader: this.runtime.assetPreloader,
        shipLoader,
        combat: this.runtime.combat,
        combatConfig: this.runtime.combatConfig,
        npcBehaviorConfig: this.runtime.npcBehaviorConfig,
        missionNavigation: this.runtime.missionNavigation,
      },
    );

    world.updateHazards(dt);
    this.asteroidHitCooldown = Math.max(0, this.asteroidHitCooldown - dt);
    this.asteroidHitCooldown = updatePlayerAsteroidCollisions(
      this.runtime,
      this.asteroidHitCooldown,
    );

    updateMissionLodStates(
      this.runtime.host.scene,
      world.collectLodRuntimes(),
    );

    wreckDebris.update(dt);
    engineVfx.update();

    const audioFrame = buildMissionAudioContext({
      actors: world.actors,
      player,
      input: playerInput,
      dt,
      camera: this.runtime.camera.getCamera(),
      npcBehaviorConfig: this.runtime.npcBehaviorConfig,
      prevListenerPosition: input.prevListenerPosition,
    });

    return {
      waveState: this.waveState,
      audioContext: audioFrame.context,
      prevListenerPosition: audioFrame.prevListenerPosition,
    };
  }
}
