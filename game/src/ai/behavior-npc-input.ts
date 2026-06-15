import { Vector3 } from '@babylonjs/core';
import { randomSign } from '@rogue-leader/engine';
import type { NpcBehaviorConfig, NpcStateId } from '../data/config/npc-behavior-config';
import { getShipForward } from '../flight/ship-forward';
import type { NpcInput, NpcInputContext, NpcInputResult } from '../player/input/npc-input';
import {
  computeAlignment,
  computeCohesion,
  computeSeparation,
} from './boid-forces';
import { tickBehaviorNpcFireGate } from './combat-ai-utils';
import type { EnemyBehavior } from './enemy-behavior';
import type { FlockNavigationKit } from './navigation/mission-navigation';
import type { FlockCombatRole } from './navigation/nav-types';
import {
  getZoneReturnTarget,
  isInsideAnyZone,
} from './navigation/zone-utils';
import { NpcStateMachine } from './npc-state-machine';
import {
  blendFlockSteering,
  computeDirectionToTarget,
  computeEnemyApproachDirection,
  normalizeSteerDirection,
  steeringToVehicleInput,
} from './steering-utils';

export interface NpcSteeringDebugInfo {
  state: NpcStateId;
  steerTarget: Vector3;
  waypointIndex?: number;
  mode: 'path' | 'wander' | 'direct';
}

const WEIGHT_PLAYER_CHASE = 0.22;
const WEIGHT_WANDER_GUARD_CHASE = 0.1;

function stateMachineConfigForRole(
  config: NpcBehaviorConfig,
  role: FlockCombatRole,
): NpcBehaviorConfig {
  if (role === 'patrol_only') {
    return { ...config, transitions: [] };
  }
  if (role === 'wander_guard') {
    return {
      ...config,
      transitions: [
        { from: 'patrol', to: 'chase', when: 'radar_hostile' },
        { from: 'chase', to: 'patrol', when: 'radar_clear' },
      ],
    };
  }
  return config;
}

/** State machine + path / wander + boid blending. */
export class BehaviorNpcInput implements NpcInput {
  private readonly stateMachine: NpcStateMachine;
  private readonly combatRole: FlockCombatRole;
  private fireCooldown = 0;
  private flankSide = 1;
  private lastDebug: NpcSteeringDebugInfo = {
    state: 'patrol',
    steerTarget: Vector3.Zero(),
    mode: 'direct',
  };

  constructor(
    private readonly config: NpcBehaviorConfig,
    private readonly navigation: FlockNavigationKit,
    private readonly behaviorStyle: EnemyBehavior = 'attack',
    combatRole?: FlockCombatRole,
  ) {
    this.combatRole = combatRole ?? navigation.combatRole ?? 'hunter';
    this.stateMachine = new NpcStateMachine(
      stateMachineConfigForRole(config, this.combatRole),
    );
    if (behaviorStyle === 'flank') {
      this.flankSide = randomSign();
    }
  }

  getDebugInfo(): NpcSteeringDebugInfo {
    return this.lastDebug;
  }

  update(dt: number, context: NpcInputContext): NpcInputResult {
    const pos = context.vehiclePosition;
    const { direction: playerDir, distance: playerDist } = computeDirectionToTarget(
      pos,
      context.playerPosition,
      getShipForward(context.vehicleRotation),
    );

    const wanderZones = this.navigation.wander?.getZoneDefinitions() ?? [];
    const inZone =
      wanderZones.length === 0 || isInsideAnyZone(pos, wanderZones);

    const effectiveHostileDist = this.effectiveHostileDistance(
      playerDist,
      inZone,
      context.playerIsHostile,
    );
    const state = this.stateMachine.update({ hostileDistance: effectiveHostileDist });
    const stateParams = this.stateMachine.getStateParams();

    let primaryDir: Vector3;
    let navMode: NpcSteeringDebugInfo['mode'] = 'direct';
    let waypointIndex: number | undefined;

    const mustReturnToZone =
      this.combatRole === 'wander_guard' && wanderZones.length > 0 && !inZone;

    if (mustReturnToZone) {
      const returnTarget = getZoneReturnTarget(pos, wanderZones);
      primaryDir = returnTarget.subtract(pos);
      navMode = 'wander';
    } else if (state === 'patrol') {
      if (this.navigation.path) {
        const target = this.navigation.path.getSteeringTarget(pos);
        primaryDir = target.subtract(pos);
        navMode = 'path';
        waypointIndex = this.navigation.path.getDebugInfo(pos).waypointIndex;
      } else if (this.navigation.wander) {
        const target = this.navigation.wander.getSteeringTarget(pos);
        primaryDir = target.subtract(pos);
        navMode = 'wander';
      } else {
        primaryDir = getShipForward(context.vehicleRotation);
        navMode = 'direct';
      }
    } else {
      primaryDir = computeEnemyApproachDirection(
        this.behaviorStyle,
        playerDir,
        playerDist,
        this.flankSide,
        'combat',
        state,
      );
      navMode = 'direct';
    }

    primaryDir = normalizeSteerDirection(primaryDir, playerDir);

    const separation = computeSeparation(
      pos,
      context.vehicleColliderRadius,
      context.flockMates,
    );
    const alignment = computeAlignment(pos, context.flockMates);
    const cohesion = computeCohesion(pos, context.flockCenter);

    const moveDir = blendFlockSteering(
      primaryDir,
      separation,
      alignment,
      cohesion,
      playerDir,
      {
        separation: stateParams.separationWeight,
        alignment: stateParams.alignmentWeight,
        cohesion: stateParams.cohesionWeight,
        playerChase: this.playerChaseWeight(state, inZone),
      },
    );

    const steerDir = normalizeSteerDirection(moveDir, primaryDir);

    const vehicle = steeringToVehicleInput(
      context.vehicleRotation,
      steerDir,
      context.cruiseSpeed,
      context.vehicleSpeed,
      stateParams.speedFactor,
    );

    this.lastDebug = {
      state,
      steerTarget: pos.add(steerDir.scale(80)),
      waypointIndex,
      mode: navMode,
    };

    const fire = tickBehaviorNpcFireGate(
      this.fireCooldown,
      dt,
      playerDist,
      this.config,
      this.combatRole,
      state,
      inZone,
      this.behaviorStyle,
    );
    this.fireCooldown = fire.cooldownSec;

    return { vehicle, wantsFire: fire.wantsFire };
  }

  private effectiveHostileDistance(
    playerDist: number,
    inZone: boolean,
    playerIsHostile: boolean,
  ): number {
    if (!playerIsHostile) {
      return this.config.loseRadarRange + 1;
    }
    if (this.combatRole === 'patrol_only') {
      return this.config.loseRadarRange + 1;
    }
    if (this.combatRole === 'wander_guard' && !inZone) {
      return this.config.loseRadarRange + 1;
    }
    return playerDist;
  }

  private playerChaseWeight(state: NpcStateId, inZone: boolean): number {
    if (state === 'patrol') return 0;
    if (this.combatRole === 'wander_guard') {
      return inZone ? WEIGHT_WANDER_GUARD_CHASE : 0;
    }
    return WEIGHT_PLAYER_CHASE;
  }
}
