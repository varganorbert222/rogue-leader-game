import type { BabylonHost } from '@rogue-leader/engine';
import type { World } from '../ecs/world';
import type { DeathEffectManager } from '../vfx/death-effect-manager';
import type { EntityId } from '../ecs/entity-id';
import {
  getShipPosition,
  getShipRotation,
  getShipVelocity,
} from '../ecs/queries/ship-queries';
import { spawnEntityDeathVfx } from '../vfx/entity-death-vfx';
import type { MissionConfig, MissionEndState } from '../mission/mission-types';
import { MissionEndStates } from '../mission/mission-types';
import type { WaveSpawnState } from '../simulation/systems/wave-spawn-system';
import { isDestroyAllEnemiesWon } from '../simulation/systems/wave-spawn-system';
import type { GameEventBus } from '../core/events/game-events';
import { GameEvents } from '../core/events/game-events';
import type { MissionSpawnPolicy } from '../mission/spawn/mission-spawn-policy';

export type MissionOutcomeAction =
  | { type: 'continue' }
  | { type: 'win' }
  | { type: 'lose'; disablePlayerRoot: true }
  | { type: 'respawn'; disablePlayerRoot: true };

export interface MissionOutcomeInput {
  world: World;
  host: BabylonHost;
  deathEffects: DeathEffectManager;
  events: GameEventBus;
  config: MissionConfig;
  spawnPolicy: MissionSpawnPolicy;
  playerId: EntityId;
  waveState: WaveSpawnState;
  npcCount: number;
  invincible: boolean;
  endState: MissionEndState;
  respawnPending: boolean;
}

/** Win/lose and respawn rules evaluated after each simulation tick. */
export class MissionOutcomeEvaluator {
  evaluate(input: MissionOutcomeInput): {
    endState: MissionEndState;
    respawnPending: boolean;
    action: MissionOutcomeAction;
  } {
    const playerHealth = input.world.get(input.playerId, 'health');

    if (!playerHealth || input.invincible || !playerHealth.isDead()) {
      if (isDestroyAllEnemiesWon(input.config, input.waveState, input.npcCount)) {
        input.events.emit(GameEvents.missionEnded());
        return {
          endState: MissionEndStates.Won,
          respawnPending: input.respawnPending,
          action: { type: 'win' },
        };
      }
      return {
        endState: input.endState,
        respawnPending: input.respawnPending,
        action: { type: 'continue' },
      };
    }

    if (input.spawnPolicy.respawnOnDeath) {
      if (input.respawnPending) {
        return {
          endState: input.endState,
          respawnPending: true,
          action: { type: 'continue' },
        };
      }
      this.playPlayerDeathVfx(input);
      return {
        endState: input.endState,
        respawnPending: true,
        action: { type: 'respawn', disablePlayerRoot: true },
      };
    }

    this.playPlayerDeathVfx(input);
    input.events.emit(GameEvents.missionEnded());
    return {
      endState: MissionEndStates.Lost,
      respawnPending: input.respawnPending,
      action: { type: 'lose', disablePlayerRoot: true },
    };
  }

  private playPlayerDeathVfx(input: MissionOutcomeInput): void {
    spawnEntityDeathVfx(
      {
        host: input.host,
        world: input.world,
        deathEffects: input.deathEffects,
      },
      {
        entityId: input.playerId,
        position: getShipPosition(input.world, input.playerId),
        kinematics: {
          position: getShipPosition(input.world, input.playerId).clone(),
          rotationQuaternion: getShipRotation(input.world, input.playerId).clone(),
          velocity: getShipVelocity(input.world, input.playerId).clone(),
        },
      },
    );
  }
}
