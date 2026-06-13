import { Vector3 } from '@babylonjs/core';
import type { NpcBehaviorConfig, NpcStateId } from '../data/config/npc-behavior-config';
import { directionToVehicleInput } from '../flight/flight-steering';
import { getShipForward } from '../flight/ship-forward';
import type { NpcInput, NpcInputContext, NpcInputResult } from '../player/input/npc-input';
import {
  computeAlignment,
  computeCohesion,
  computeSeparation,
} from './boid-forces';
import type { FlockNavigationKit } from './navigation/mission-navigation';
import type { FlockCombatRole } from './navigation/nav-types';
import {
  getZoneReturnTarget,
  isInsideAnyZone,
} from './navigation/zone-utils';
import { NpcStateMachine } from './npc-state-machine';
import type { EnemyBehavior } from './boid-npc-input';

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
  role: FlockCombatRole
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
    combatRole?: FlockCombatRole
  ) {
    this.combatRole = combatRole ?? navigation.combatRole ?? 'hunter';
    this.stateMachine = new NpcStateMachine(
      stateMachineConfigForRole(config, this.combatRole)
    );
    if (behaviorStyle === 'flank') {
      this.flankSide = Math.random() > 0.5 ? 1 : -1;
    }
  }

  getDebugInfo(): NpcSteeringDebugInfo {
    return this.lastDebug;
  }

  update(dt: number, context: NpcInputContext): NpcInputResult {
    const pos = context.vehiclePosition;
    const toPlayer = context.playerPosition.clone().subtract(pos);
    const playerDist = toPlayer.length();
    const playerDir =
      playerDist > 0.01
        ? toPlayer.normalize()
        : getShipForward(context.vehicleRotation);

    const wanderZones = this.navigation.wander?.getZoneDefinitions() ?? [];
    const inZone =
      wanderZones.length === 0 || isInsideAnyZone(pos, wanderZones);

    const effectiveHostileDist = this.effectiveHostileDistance(
      playerDist,
      inZone
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
      primaryDir = this.computeCombatDirection(state, playerDir, playerDist);
      navMode = 'direct';
    }

    if (primaryDir.lengthSquared() < 1e-4) {
      primaryDir = playerDir.clone();
    } else {
      primaryDir.normalize();
    }

    const separation = computeSeparation(
      pos,
      context.vehicleColliderRadius,
      context.flockMates
    );
    const alignment = computeAlignment(pos, context.flockMates);
    const cohesion = computeCohesion(pos, context.flockCenter);

    const playerChaseWeight = this.playerChaseWeight(state, inZone);

    const moveDir = primaryDir
      .clone()
      .add(separation.scale(stateParams.separationWeight))
      .add(alignment.scale(stateParams.alignmentWeight))
      .add(cohesion.scale(stateParams.cohesionWeight))
      .add(playerDir.scale(playerChaseWeight));

    const steerDir = moveDir.lengthSquared() < 1e-4 ? primaryDir : moveDir.normalize();

    const fwd = getShipForward(context.vehicleRotation);
    const alignmentDot = Vector3.Dot(fwd, steerDir);
    const targetSpeed =
      context.cruiseSpeed * stateParams.speedFactor * (0.7 + alignmentDot * 0.3);
    const speedDelta = targetSpeed - context.vehicleSpeed;
    const vehicle = directionToVehicleInput(
      context.vehicleRotation,
      steerDir,
      speedDelta
    );

    this.lastDebug = {
      state,
      steerTarget: pos.add(steerDir.scale(80)),
      waypointIndex,
      mode: navMode,
    };

    this.fireCooldown -= dt;
    const wantsFire = this.shouldFire(state, playerDist, inZone);

    return { vehicle, wantsFire };
  }

  private effectiveHostileDistance(playerDist: number, inZone: boolean): number {
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

  private shouldFire(
    state: NpcStateId,
    playerDist: number,
    inZone: boolean
  ): boolean {
    if (this.fireCooldown > 0) return false;
    if (this.combatRole === 'patrol_only') return false;

    if (this.combatRole === 'wander_guard') {
      if (state !== 'chase' || !inZone) return false;
      if (playerDist > this.config.fireRange * 0.65) return false;
      this.fireCooldown = 1.4;
      return true;
    }

    if (state !== 'attack' || playerDist >= this.config.fireRange) return false;
    this.fireCooldown = this.behaviorStyle === 'attack' ? 0.8 : 1.2;
    return true;
  }

  private computeCombatDirection(
    state: NpcStateId,
    playerDir: Vector3,
    playerDist: number
  ): Vector3 {
    if (this.behaviorStyle === 'flank' && playerDist > 60) {
      const right = Vector3.Cross(Vector3.Up(), playerDir).normalize();
      const flankScale = state === 'attack' ? 0.5 : 0.35;
      return playerDir.add(right.scale(this.flankSide * flankScale)).normalize();
    }
    if (this.behaviorStyle === 'chase' || state === 'chase') {
      return playerDir.clone();
    }
    return playerDir.scale(state === 'attack' ? 1 : 0.85).normalize();
  }
}
