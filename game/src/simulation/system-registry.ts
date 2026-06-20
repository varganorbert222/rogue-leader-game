import { CombatTeams } from '../config/constants';
import { resolveFaction } from '../combat/faction';
import { GameEvents } from '../core/events/game-events';
import { collectHostileTargets } from '../ecs/queries/combat-queries';
import type { EntityId } from '../ecs/entity-id';
import type { PlayerInput } from '../player/input/player-input';
import type { GltfShipLoader } from '@rogue-leader/engine';
import { Vector3 } from '@babylonjs/core';
import { buildMissionAudioContext } from './services/mission-audio-context';
import type { MissionRuntimeContext } from './runtime-context';
import { runAsteroidTumbleSystem } from './systems/asteroid-tumble-system';
import { updateMissionLodStates } from './systems/lod-update-system';
import { runNpcSystem } from './systems/npc-system';
import { runPlayerSystem } from './systems/player-system';
import {
  createInitialWaveState,
  updateWaveSpawning,
  type WaveSpawnState,
} from './systems/wave-spawn-system';
import {
  createShipCollisionState,
  updateShipCollisions,
  type ShipCollisionState,
} from './systems/ship-collision-system';

export interface SimulationTickInput {
  dt: number;
  playerId: EntityId;
  playerInput: PlayerInput;
  boundary?: { center: Vector3; radius: number };
  shipLoader: GltfShipLoader;
  prevListenerPosition: Vector3 | null;
}

export interface SimulationTickResult {
  waveState: WaveSpawnState;
  audioContext: ReturnType<typeof buildMissionAudioContext>['context'];
  prevListenerPosition: Vector3;
}

/** Ordered simulation phases executed each frame by {@link MissionSimulationCoordinator}. */
export class SimulationSystemRegistry {
  private waveState: WaveSpawnState;
  private readonly shipCollisionState: ShipCollisionState;

  constructor(
    private readonly runtime: MissionRuntimeContext,
    waveState?: WaveSpawnState,
  ) {
    this.waveState = waveState ?? createInitialWaveState(runtime.config);
    this.shipCollisionState = createShipCollisionState();
  }

  getWaveState(): WaveSpawnState {
    return this.waveState;
  }

  resetWaveState(config = this.runtime.config): void {
    this.waveState = createInitialWaveState(config);
    this.shipCollisionState.pairCooldowns.clear();
  }

  tick(input: SimulationTickInput): SimulationTickResult {
    const { dt, playerId, playerInput, boundary, shipLoader } = input;
    const { world } = this.runtime;

    this.runEntitySystems(dt, playerId, playerInput, boundary);
    this.runCombatSystems(dt, playerId, playerInput);
    this.runMissionSystems(dt, playerId, playerInput, boundary, shipLoader);
    this.runHazardSystems(dt);
    this.runPresentationSystems(dt);

    const audioFrame = buildMissionAudioContext({
      world,
      playerId,
      input: playerInput,
      dt,
      camera: this.runtime.camera.getCamera(),
      cockpitView: this.runtime.camera.getMode() === 'cockpit',
      npcBehaviorConfig: this.runtime.npcBehaviorConfig,
      prevListenerPosition: input.prevListenerPosition,
    });

    return {
      waveState: this.waveState,
      audioContext: audioFrame.context,
      prevListenerPosition: audioFrame.prevListenerPosition,
    };
  }

  private runEntitySystems(
    dt: number,
    playerId: EntityId,
    playerInput: PlayerInput,
    boundary?: { center: Vector3; radius: number },
  ): void {
    const { world } = this.runtime;

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
  }

  private runCombatSystems(
    dt: number,
    playerId: EntityId,
    playerInput: PlayerInput,
  ): void {
    const { world } = this.runtime;
    const weaponEnergy = world.get(playerId, 'weaponEnergy');
    weaponEnergy?.setRegenBlocked(playerInput.combat.fire);

    if (world.has(playerId, 'flight')) {
      this.runtime.combat.updatePassByObserver({
        position: this.runtime.camera.getCamera().position.clone(),
        team: CombatTeams.Player,
      });
    }

    this.runtime.combat.updateWeapons(world.collectShipWeaponSystems(), dt);
    weaponEnergy?.endFrame(dt);

    if (playerInput.vehicle.boost) {
      this.runtime.events.emit(GameEvents.boostStarted());
    }
  }

  private runMissionSystems(
    dt: number,
    playerId: EntityId,
    _playerInput: PlayerInput,
    _boundary: { center: Vector3; radius: number } | undefined,
    shipLoader: GltfShipLoader,
  ): void {
    const { world } = this.runtime;

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
        playerFaction:
          world.get(playerId, 'faction') ??
          resolveFaction(
            this.runtime.assetManifest.ships[this.runtime.config.player.shipId]
              ?.faction,
          ),
      },
    );

    updateShipCollisions(this.runtime, this.shipCollisionState, dt);
  }

  private runHazardSystems(dt: number): void {
    runAsteroidTumbleSystem(this.runtime.world, dt);
  }

  private runPresentationSystems(dt: number): void {
    updateMissionLodStates(
      this.runtime.host.scene,
      this.runtime.world.collectLodRuntimes(),
    );
    this.runtime.deathEffects.update(dt);
  }
}
