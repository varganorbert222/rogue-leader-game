import { Vector3 } from '@babylonjs/core';
import type { GltfShipLoader } from '@rogue-leader/engine';
import type { EntityId } from '../../ecs/entity-id';
import type { PlayerInput } from '../../player/input/player-input';
import type { GameAudioUpdateContext } from '../../audio/game-audio-bridge';
import type { MissionRuntimeContext } from '../runtime-context';
import { resolveProjectileHit } from '../systems/damage-resolution-system';
import {
  SimulationSystemRegistry,
  type SimulationTickInput,
  type SimulationTickResult,
} from '../system-registry';
import type { WaveSpawnState } from '../systems/wave-spawn-system';

export type MissionSimulationTickInput = SimulationTickInput;
export type MissionSimulationTickResult = SimulationTickResult;

/** Fixed-order per-frame mission simulation tick. */
export class MissionSimulationCoordinator {
  private readonly registry: SimulationSystemRegistry;

  constructor(
    private readonly runtime: MissionRuntimeContext,
    waveState?: WaveSpawnState,
  ) {
    this.registry = new SimulationSystemRegistry(runtime, waveState);
  }

  getWaveState(): WaveSpawnState {
    return this.registry.getWaveState();
  }

  resetWaveState(config = this.runtime.config): void {
    this.registry.resetWaveState(config);
  }

  wireCombatTargets(): void {
    this.runtime.combat.initTargets(
      () => this.runtime.world.collectProjectileTargetBodies(),
      (hit) => resolveProjectileHit(this.runtime, hit),
    );
  }

  tick(input: MissionSimulationTickInput): MissionSimulationTickResult {
    return this.registry.tick(input);
  }
}
