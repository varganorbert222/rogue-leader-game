import type { AssetManifest, BabylonHost } from '@rogue-leader/engine';
import type { WeaponsManifest } from '../config/loaders/weapons-manifest';
import type { CombatConfig } from '../config/loaders/combat-config';
import type { NpcBehaviorConfig } from '../config/loaders/npc-behavior-config';
import type { RenderConfig } from '../config/loaders/render-config';
import type { MissionNavigation } from '../ai/navigation/mission-navigation';
import type { MissionAssetPreloader } from '../mission/loading/mission-asset-preloader';
import type { WeaponHitSfxResolver } from '../audio/weapon-hit-sfx';
import type { CameraController } from '../flight/camera-controller';
import type { CollisionSystem } from '../collision/collision-system';
import type { DebugPreferences } from '../debug/debug-preferences';
import type { GameEventBus } from '../core/events/game-events';
import type { DeathEffectManager } from '../vfx/death-effect-manager';
import type { AsteroidSpawnService } from '../hazards/asteroid-spawn-service';
import type { CombatSystem } from '../combat/systems/combat-system';
import type { MissionConfig } from '../mission/mission-types';
import type { World } from '../ecs/world';

/** Shared runtime dependencies injected into mission simulation systems. */
export interface MissionRuntimeContext {
  host: BabylonHost;
  world: World;
  combat: CombatSystem;
  collision: CollisionSystem;
  camera: CameraController;
  deathEffects: DeathEffectManager;
  asteroids: AsteroidSpawnService;
  assetPreloader: MissionAssetPreloader;
  assetManifest: AssetManifest;
  weaponsManifest: WeaponsManifest;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
  renderConfig: RenderConfig;
  missionNavigation: MissionNavigation;
  hitSfxResolver?: WeaponHitSfxResolver;
  events: GameEventBus;
  debugPreferences: DebugPreferences;
  config: MissionConfig;
}
