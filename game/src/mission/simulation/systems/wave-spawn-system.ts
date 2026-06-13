import { Vector3 } from '@babylonjs/core';
import type { AssetManifest, GltfShipLoader } from '@rogue-leader/engine';
import { BehaviorNpcInput } from '../../../ai/behavior-npc-input';
import type { MissionNavigation } from '../../../ai/navigation/mission-navigation';
import { resolveFaction } from '../../../combat/faction';
import type { CombatConfig } from '../../../data/config/combat-config';
import type { NpcBehaviorConfig } from '../../../data/config/npc-behavior-config';
import { WinConditionTypes } from '../../../data/constants';
import { HealthComponent } from '../../../actors/health-component';
import { NpcActor } from '../../../actors/npc-actor';
import type { ActorRegistry } from '../../../actors/actor-registry';
import type { MissionAssetPreloader } from '../../../mission/loading/mission-asset-preloader';
import { Vehicle } from '../../../vehicles/vehicle';
import type { CombatSystem } from '../../../combat/systems/combat-system';
import type { MissionConfig, MissionWave } from '../../mission-types';
import { missionWaveCount, missionWaves } from '../utils/wave-display';

export interface WaveSpawnState {
  wavesSpawned: number;
  waveTimer: number;
  waveSpawnInProgress: boolean;
}

export interface WaveSpawnContext {
  actors: ActorRegistry;
  assetManifest: AssetManifest;
  assetPreloader: MissionAssetPreloader;
  shipLoader: GltfShipLoader;
  combat: CombatSystem;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
  missionNavigation: MissionNavigation;
}

export function createInitialWaveState(config: MissionConfig): WaveSpawnState {
  return {
    wavesSpawned: 0,
    waveSpawnInProgress: false,
    waveTimer: missionWaves(config.waves)[0]?.delaySec ?? 0,
  };
}

export function isDestroyAllEnemiesWon(
  config: MissionConfig,
  state: WaveSpawnState,
  npcCount: number,
): boolean {
  if (config.winCondition.type !== WinConditionTypes.DestroyAllEnemies) {
    return false;
  }
  const total = missionWaveCount(config.waves);
  if (total === 0) return false;
  if (state.waveSpawnInProgress) return false;
  return state.wavesSpawned >= total && npcCount === 0;
}

export function updateWaveSpawning(
  state: WaveSpawnState,
  dt: number,
  config: MissionConfig,
  npcCount: number,
  spawnCtx: WaveSpawnContext,
): void {
  const waves = missionWaves(config.waves);
  if (state.waveSpawnInProgress || state.wavesSpawned >= waves.length) return;

  const nextWave = waves[state.wavesSpawned];
  if (!nextWave) return;

  const clearanceGated = nextWave.trigger?.endsWith('_cleared') ?? false;
  if (clearanceGated && npcCount > 0) return;

  if (!clearanceGated && state.waveTimer > 0) {
    state.waveTimer -= dt;
    return;
  }

  if (clearanceGated && state.waveTimer > 0) {
    state.waveTimer -= dt;
  }

  state.waveSpawnInProgress = true;
  spawnWave(nextWave, spawnCtx);
  state.wavesSpawned++;
  if (state.wavesSpawned < waves.length) {
    state.waveTimer = waves[state.wavesSpawned].delaySec;
  }
  state.waveSpawnInProgress = false;
}

export function spawnWave(wave: MissionWave, ctx: WaveSpawnContext): void {
  for (const spec of wave.enemies) {
    const entry = ctx.assetManifest.ships[spec.shipId];
    if (!entry) continue;
    const npcId = `enemy_${ctx.actors.getNpcCount()}`;
    const loaded = ctx.assetPreloader.shipPool.acquireNpcShip(
      spec.shipId,
      npcId,
      ctx.shipLoader,
    );
    loaded.root.position = Vector3.FromArray(spec.spawn);
    const faction = resolveFaction(entry.faction);
    const weapons = ctx.combat.attachWeapons(
      loaded.root,
      entry,
      'enemy',
      loaded.anchors,
    );
    const vehicle = Vehicle.spawn({
      id: npcId,
      shipId: spec.shipId,
      shipEntry: entry,
      loaded,
      faction,
      combatTeam: 'enemy',
      weapons,
      flightDefaults: ctx.combatConfig.defaults.flight,
    });
    const navKit = ctx.missionNavigation.createFlockKit(
      wave.id,
      ctx.npcBehaviorConfig.pathArriveRadius,
      ctx.npcBehaviorConfig.wanderRetargetRadius,
    );
    const combatRole =
      navKit.combatRole ??
      ctx.missionNavigation.getFlockAssignment(wave.id)?.combatRole ??
      'hunter';
    ctx.actors.addNpc(
      new NpcActor(
        npcId,
        wave.id,
        new HealthComponent(40, 40, 0, 0),
        vehicle,
        new BehaviorNpcInput(
          ctx.npcBehaviorConfig,
          navKit,
          spec.behavior,
          combatRole,
        ),
        faction,
      ),
    );
  }
}
