import type { AssetManifest, BabylonHost } from '@rogue-leader/engine';
import type { WeaponsManifest } from '../../data/config/weapons-manifest';
import type { CombatConfig } from '../../data/config/combat-config';
import type { NpcBehaviorConfig } from '../../data/config/npc-behavior-config';
import type { MissionNavigation } from '../../ai/navigation/mission-navigation';
import type { MissionAssetPreloader } from '../loading/mission-asset-preloader';
import type { WeaponHitSfxResolver } from '../../audio/weapon-hit-sfx';
import type { CameraController } from '../../flight/camera-controller';
import type { CollisionSystem } from '../../collision/collision-system';
import type { DebugPreferences } from '../../debug/debug-preferences';
import type { GameEventBus } from '../../core/events/game-events';
import type { WreckDebrisManager } from '../../vfx/wreck-debris-manager';
import type { CombatSystem } from '../../combat/systems/combat-system';
import type { MissionConfig } from '../mission-types';
import type { World } from '../../ecs/world';

/** Shared runtime dependencies injected into mission simulation systems. */
export interface MissionRuntimeContext {
  host: BabylonHost;
  world: World;
  combat: CombatSystem;
  collision: CollisionSystem;
  camera: CameraController;
  wreckDebris: WreckDebrisManager;
  assetPreloader: MissionAssetPreloader;
  assetManifest: AssetManifest;
  weaponsManifest: WeaponsManifest;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
  missionNavigation: MissionNavigation;
  hitSfxResolver?: WeaponHitSfxResolver;
  events: GameEventBus;
  debugPreferences: DebugPreferences;
  config: MissionConfig;
}
