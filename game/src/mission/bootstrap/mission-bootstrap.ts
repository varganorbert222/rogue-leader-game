import { GltfShipLoader, LodShipLoader, loadAssetManifest, RuntimePaths, type AssetManifest, type LodLoadProgress } from '@rogue-leader/engine';
import type { BabylonHost } from '@rogue-leader/engine';
import { loadCombatConfig, type CombatConfig } from '../../data/config/combat-config';
import { loadWeaponsManifest, type WeaponsManifest } from '../../data/config/weapons-manifest';
import { loadNpcBehaviorConfig, type NpcBehaviorConfig } from '../../data/config/npc-behavior-config';
import { loadRenderConfig, type RenderConfig } from '../../data/config/render-config';
import { MissionNavigation } from '../../ai/navigation/mission-navigation';
import { CombatSystem } from '../../combat/systems/combat-system';
import { GameEvents, type GameEventBus } from '../../core/events/game-events';
import { WeaponHitSfxResolver } from '../../audio/weapon-hit-sfx';
import type { WreckDebrisManager } from '../../vfx/wreck-debris-manager';
import type { CameraController } from '../../flight/camera-controller';
import type { CollisionSystem } from '../../collision/collision-system';
import type { DebugPreferences } from '../../debug/debug-preferences';
import { MissionAssetPreloader } from '../loading/mission-asset-preloader';
import { requireMissionConfig } from '../mission-registry';
import type { MissionConfig } from '../mission-types';
import type { MissionRuntimeContext } from '../simulation/mission-runtime-context';
import { MissionSimulationCoordinator } from '../simulation/coordinator/mission-simulation-coordinator';
import type { World } from '../../ecs/world';

export interface MissionBootstrapInput {
  host: BabylonHost;
  missionId: string;
  world: World;
  collision: CollisionSystem;
  camera: CameraController;
  events: GameEventBus;
  wreckDebris: WreckDebrisManager;
  debugPreferences: DebugPreferences;
  onLoadMessage?: (message: string) => void;
  onLoadProgress?: (progress: LodLoadProgress) => void;
}

export interface MissionBootstrapResult {
  config: MissionConfig;
  assetManifest: AssetManifest;
  weaponsManifest: WeaponsManifest;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
  renderConfig: RenderConfig;
  missionNavigation: MissionNavigation;
  shipLoader: GltfShipLoader;
  combat: CombatSystem;
  hitSfxResolver: WeaponHitSfxResolver;
  assetPreloader: MissionAssetPreloader;
  simulation: MissionSimulationCoordinator;
  runtime: MissionRuntimeContext;
}

/** Loads configs, assets, and combat systems for a mission session. */
export class MissionBootstrap {
  static async run(input: MissionBootstrapInput): Promise<MissionBootstrapResult> {
    const config = requireMissionConfig(input.missionId);
    const assetManifest = await loadAssetManifest(RuntimePaths.assetManifest);
    const weaponsManifest = await loadWeaponsManifest(RuntimePaths.weaponsManifest);
    const hitSfxResolver = new WeaponHitSfxResolver(weaponsManifest);
    const combatConfig = await loadCombatConfig(RuntimePaths.combatConfig);
    const npcBehaviorConfig = await loadNpcBehaviorConfig(RuntimePaths.npcBehaviorConfig);
    const renderConfig = await loadRenderConfig(RuntimePaths.renderConfig);
    const missionNavigation = new MissionNavigation(config.navigation);

    const lodLoader = new LodShipLoader(input.host.scene, RuntimePaths.assetsBase);
    const shipLoader = new GltfShipLoader(input.host.scene, RuntimePaths.assetsBase, lodLoader);
    shipLoader.setEmissiveBloomStrength(renderConfig.bloom.emissive.strength);
    shipLoader.setLodProgressCallback((progress) => {
      input.onLoadMessage?.(progress.message);
      input.onLoadProgress?.(progress);
    });

    const assetPreloader = new MissionAssetPreloader();
    await assetPreloader.preloadAll({
      config,
      manifest: assetManifest,
      weaponsManifest,
      scene: input.host.scene,
      shipLoader,
      wreckDebris: input.wreckDebris,
      audio: input.host.audio,
      onMessage: input.onLoadMessage,
    });

    const combat = new CombatSystem(input.host.scene, input.events);
    combat.setWeaponsManifest(weaponsManifest);
    combat.setProjectileBloomStrength(renderConfig.bloom.projectiles.strength);
    combat.initProjectilePassBy((_weaponId, point, velocity) => {
      input.events.emit(
        GameEvents.projectileWhoosh({
          position: point,
          velocity,
        }),
      );
    });

    const runtime: MissionRuntimeContext = {
      host: input.host,
      world: input.world,
      combat,
      collision: input.collision,
      camera: input.camera,
      wreckDebris: input.wreckDebris,
      assetPreloader,
      assetManifest,
      weaponsManifest,
      combatConfig,
      npcBehaviorConfig,
      renderConfig,
      missionNavigation,
      hitSfxResolver,
      events: input.events,
      debugPreferences: input.debugPreferences,
      config,
    };

    const simulation = new MissionSimulationCoordinator(runtime);
    simulation.wireCombatTargets();
    simulation.resetWaveState(config);

    shipLoader.setLodProgressCallback(undefined);

    return {
      config,
      assetManifest,
      weaponsManifest,
      combatConfig,
      npcBehaviorConfig,
      renderConfig,
      missionNavigation,
      shipLoader,
      combat,
      hitSfxResolver,
      assetPreloader,
      simulation,
      runtime,
    };
  }
}
