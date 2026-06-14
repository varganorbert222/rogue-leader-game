import { Vector3 } from '@babylonjs/core';
import type { GltfShipLoader } from '@rogue-leader/engine';
import { CombatTeams } from '../../../data/constants';
import { GameEvents } from '../../../core/events/game-events';
import { collectHostileTargets } from '../../../ecs/queries/combat-queries';
import { runNpcSystem } from '../../../ecs/systems/npc-system';
import { runPlayerSystem } from '../../../ecs/systems/player-system';
import type { EntityId } from '../../../ecs/entity-id';
import type { PlayerInput } from '../../../player/input/player-input';
import type { GameAudioUpdateContext } from '../../../audio/game-audio-bridge';
import type { WreckDebrisManager } from '../../../vfx/wreck-debris-manager';
import { buildMissionAudioContext } from '../services/mission-audio-context';
import type { MissionRuntimeContext } from '../mission-runtime-context';
import { resolveProjectileHit } from '../systems/damage-resolution-system';
import { updatePlayerAsteroidCollisions } from '../systems/hazard-collision-system';
import { updateMissionLodStates } from '../systems/lod-update-system';
import {
  createInitialWaveState,
  updateWaveSpawning,
  type WaveSpawnState,
} from '../systems/wave-spawn-system';

export interface MissionSimulationTickInput {
  dt: number;
  playerId: EntityId;
  playerInput: PlayerInput;
  boundary?: { center: Vector3; radius: number };
  shipLoader: GltfShipLoader;
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
    this.waveState = waveState ?? createInitialWaveState(runtime.config);
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
    const { dt, playerId, playerInput, boundary, shipLoader, wreckDebris } =
      input;
    const world = this.runtime.world;

    const weaponEnergy = world.get(playerId, 'weaponEnergy');
    weaponEnergy?.setRegenBlocked(playerInput.combat.fire);

    runPlayerSystem({
      world,
      playerId,
      dt,
      scene: this.runtime.host.scene,
      input: playerInput,
      boundary,
      camera: this.runtime.camera,
      combat: this.runtime.combat,
      events: this.runtime.events,
      targetingConfig: this.runtime.combatConfig.targeting,
      radarRadius: this.runtime.combatConfig.radar.radius,
      hostileTargets: collectHostileTargets(
        world,
        world.get(playerId, 'faction')!,
      ),
    });

    if (world.has(playerId, 'flight')) {
      this.runtime.combat.updatePassByObserver({
        position: this.runtime.camera.getCamera().position.clone(),
        team: CombatTeams.Player,
      });
    }

    this.runtime.combat.updateWeapons(world.collectShipWeaponSystems(), dt);
    weaponEnergy?.endFrame(dt);

    runNpcSystem(
      {
        scene: this.runtime.host.scene,
        world,
        combat: this.runtime.combat,
        combatConfig: this.runtime.combatConfig,
        npcBehaviorConfig: this.runtime.npcBehaviorConfig,
      },
      dt,
      playerId,
      boundary,
    );

    if (playerInput.vehicle.boost) {
      this.runtime.events.emit(GameEvents.boostStarted());
    }

    updateWaveSpawning(
      this.waveState,
      dt,
      this.runtime.config,
      world.getNpcCount(),
      {
        world,
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

    updateMissionLodStates(this.runtime.host.scene, world.collectLodRuntimes());

    wreckDebris.update(dt);

    const audioFrame = buildMissionAudioContext({
      world,
      playerId,
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
