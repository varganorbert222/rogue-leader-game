import { Vector3 } from '@babylonjs/core';
import type { AssetManifest, GltfShipLoader } from '@rogue-leader/engine';
import { BehaviorNpcInput } from '../../ai/behavior-npc-input';
import type { MissionNavigation } from '../../ai/navigation/mission-navigation';
import { resolveFaction, type FactionId } from '../../combat/faction';
import { resolveWaveEnemyShipId } from '../../config/loaders/faction-ship-roster';
import type { CombatConfig } from '../../config/loaders/combat-config';
import type { NpcBehaviorConfig } from '../../config/loaders/npc-behavior-config';
import { WinConditionTypes } from '../../config/constants';
import { HealthComponent } from '../../ecs/components/health-component';
import { spawnNpcEntity } from '../../ecs/spawn/entity-factory';
import type { World } from '../../ecs/world';
import type { MissionAssetPreloader } from '../../mission/loading/mission-asset-preloader';
import type { CombatSystem } from '../../combat/systems/combat-system';
import type { MissionConfig, MissionWave } from '../../mission/mission-types';
import { missionWaveCount, missionWaves } from '../utils/wave-display';

export interface WaveSpawnState {
  wavesSpawned: number;
  waveTimer: number;
  waveSpawnInProgress: boolean;
}

export interface WaveSpawnContext {
  world: World;
  assetManifest: AssetManifest;
  assetPreloader: MissionAssetPreloader;
  shipLoader: GltfShipLoader;
  combat: CombatSystem;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
  missionNavigation: MissionNavigation;
  /** Faction of the current player ship — drives hostile hull swapping. */
  playerFaction: FactionId;
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
    const shipId = resolveWaveEnemyShipId(
      spec.shipId,
      ctx.playerFaction,
      ctx.assetManifest,
    );
    const entry = ctx.assetManifest.ships[shipId];
    if (!entry) continue;
    const npcId = `enemy_${ctx.world.getNpcCount()}`;
    const loaded = ctx.assetPreloader.shipPool.acquireNpcShip(
      shipId,
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
    const navKit = ctx.missionNavigation.createFlockKit(
      wave.id,
      ctx.npcBehaviorConfig.pathArriveRadius,
      ctx.npcBehaviorConfig.wanderRetargetRadius,
    );
    const combatRole =
      navKit.combatRole ??
      ctx.missionNavigation.getFlockAssignment(wave.id)?.combatRole ??
      'hunter';
    spawnNpcEntity(ctx.world, {
      id: npcId,
      flockId: wave.id,
      shipId,
      shipEntry: entry,
      loaded,
      faction,
      combatTeam: 'enemy',
      weapons,
      flightDefaults: ctx.combatConfig.defaults.flight,
      health: new HealthComponent(40, 40, 0, 0),
      steering: {
        flockId: wave.id,
        input: new BehaviorNpcInput(
          ctx.npcBehaviorConfig,
          navKit,
          spec.behavior,
          combatRole,
        ),
      },
    });
  }
}
