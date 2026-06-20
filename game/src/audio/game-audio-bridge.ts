import type { Vector3 } from "@babylonjs/core";
import type { AudioManager, PlayOneShotOptions } from "@rogue-leader/engine";
import {
  EntityDestroyKinds,
  Factions,
  MusicTrackIds,
  SfxClipIds,
  DEFAULT_PLAYER_SHIP_ID,
  DamageSeverities,
} from "../config/constants";
import {
  GameEventPayloadKeys,
  GameEventTypes,
  readPayloadDestroyKind,
  readPayloadSfx,
  readPayloadString,
  readPayloadStringArray,
  readPayloadVector3,
  type GameEventBus,
} from "../core/events/game-events";
import { CombatIntensityTracker,
  type CombatIntensitySnapshot,
} from "./combat-intensity";
import {
  BULLET_WHOOSH_BASE_PATH,
  BULLET_WHOOSH_FILES,
} from "./bullet-whoosh-sfx";
import { InboundFlybyDetector } from "./inbound-flyby-detector";
import { ShipAudioCatalog } from "./ship-audio-map";
import {
  ShipEngineAudioManager,
  type ShipEngineAudioSource,
} from "./ship-engine-audio";
import { resolveEngineAudioConfig } from "./engine-audio-config";

export type { ShipEngineAudioSource } from "./ship-engine-audio";

export interface GameAudioUpdateContext extends CombatIntensitySnapshot {
  listenerPosition: Vector3;
  listenerVelocity: Vector3;
  playerPosition: Vector3;
  playerVelocity: Vector3;
  playerSpeedRatio: number;
  npcEngines: ShipEngineAudioSource[];
  /** True when the player camera is in first-person cockpit view. */
  cockpitView: boolean;
}

function spatialOptions(
  payload: Record<string, unknown> | undefined,
  extra?: Partial<PlayOneShotOptions>,
): PlayOneShotOptions {
  const position = readPayloadVector3(payload, GameEventPayloadKeys.Position);
  const velocity = readPayloadVector3(payload, GameEventPayloadKeys.Velocity);
  return {
    ...extra,
    ...(position ? { position } : {}),
    ...(velocity ? { velocity } : {}),
  };
}

export class GameAudioBridge {
  private readonly intensity = new CombatIntensityTracker();
  private readonly inbound = new InboundFlybyDetector();
  private readonly engines = new ShipEngineAudioManager();
  private missionActive = false;

  constructor(
    private readonly audio: AudioManager,
    events: GameEventBus,
  ) {
    events.on(GameEventTypes.WeaponFired, (e) => {
      const configured = readPayloadString(e.payload, GameEventPayloadKeys.Sfx);
      const faction =
        readPayloadString(e.payload, GameEventPayloadKeys.Faction) ??
        Factions.Rebel;
      const clipId =
        configured ?? ShipAudioCatalog.cannonFireClipForFaction(faction);
      this.audio.playOneShot(clipId, spatialOptions(e.payload));
    });

    events.on(GameEventTypes.ProjectileHit, (e) => {
      this.audio.playOneShot(
        readPayloadSfx(e.payload, SfxClipIds.BulletHit),
        spatialOptions(e.payload),
      );
    });

    events.on(GameEventTypes.ProjectileWhoosh, (e) => {
      const clipId = readPayloadSfx(e.payload, SfxClipIds.BulletWhoosh);
      if (clipId === SfxClipIds.WarheadWhoosh) {
        this.audio.playOneShot(clipId, spatialOptions(e.payload));
        return;
      }
      this.audio.playRandomFile(
        BULLET_WHOOSH_BASE_PATH,
        BULLET_WHOOSH_FILES,
        spatialOptions(e.payload),
      );
    });

    events.on(GameEventTypes.ShipCollision, (e) => {
      this.audio.playOneShot(
        SfxClipIds.ShipCrash,
        spatialOptions(e.payload),
      );
    });

    events.on(GameEventTypes.EntityDestroyed, (e) => {
      const kind = readPayloadDestroyKind(e.payload);
      const clip =
        kind === EntityDestroyKinds.Asteroid
          ? SfxClipIds.AsteroidExplosion
          : SfxClipIds.FighterExplosion;
      this.audio.playOneShot(clip, spatialOptions(e.payload));
    });

    events.on(GameEventTypes.ShieldHit, (e) => {
      this.intensity.notifyDamage(DamageSeverities.Shield);
      this.audio.playOneShot(
        SfxClipIds.BulletHit,
        spatialOptions(e.payload, { volume: 0.55 }),
      );
    });

    events.on(GameEventTypes.PlayerDamaged, (e) => {
      this.intensity.notifyDamage(DamageSeverities.Hull);
      this.audio.playOneShot(
        SfxClipIds.BulletHit,
        spatialOptions(e.payload, { volume: 0.7 }),
      );
    });

    events.on(GameEventTypes.AsteroidImpact, (e) => {
      this.intensity.notifyDamage(DamageSeverities.Asteroid);
    });

    events.on(GameEventTypes.SfoilToggled, (e) => {
      const files = readPayloadStringArray(
        e.payload,
        GameEventPayloadKeys.SfxFiles,
      );
      const basePath = readPayloadString(
        e.payload,
        GameEventPayloadKeys.SfxBasePath,
      );
      if (files?.length && basePath) {
        this.audio.playRandomFile(basePath, files, spatialOptions(e.payload));
        return;
      }

      const clipIds = readPayloadStringArray(
        e.payload,
        GameEventPayloadKeys.SfxClipIds,
      );
      if (clipIds?.length) {
        const clipId = clipIds[Math.floor(Math.random() * clipIds.length)];
        this.audio.playOneShot(clipId, spatialOptions(e.payload));
        return;
      }

      const clip =
        readPayloadString(e.payload, GameEventPayloadKeys.Sfx) ??
        SfxClipIds.XwingSfoil;
      this.audio.playOneShot(clip, spatialOptions(e.payload));
    });

    events.on(GameEventTypes.MissionStarted, (e) => {
      this.missionActive = true;
      this.intensity.reset();
      this.inbound.reset();
      this.engines.reset(this.audio);

      const shipId =
        readPayloadString(e.payload, GameEventPayloadKeys.PlayerShipId) ??
        DEFAULT_PLAYER_SHIP_ID;
      this.engines.setPlayerShip(shipId);
      this.engines.setConfig(
        resolveEngineAudioConfig(this.audio.getEngineAudioConfig()),
      );

      const musicSetId = readPayloadString(
        e.payload,
        GameEventPayloadKeys.MusicSetId,
      );
      const musicId =
        readPayloadString(e.payload, GameEventPayloadKeys.MusicId) ??
        MusicTrackIds.AsteroidFieldCombat;
      if (musicSetId && this.audio.startMusicSet(musicSetId)) return;
      this.audio.crossfadeMusic(musicId, 1200);
    });

    events.on(GameEventTypes.PlayerSpawned, (e) => {
      if (!this.missionActive) return;
      const shipId =
        readPayloadString(e.payload, GameEventPayloadKeys.PlayerShipId) ??
        DEFAULT_PLAYER_SHIP_ID;
      this.engines.reset(this.audio);
      this.engines.setPlayerShip(shipId);
    });

    events.on(GameEventTypes.PlayerDespawned, () => {
      if (!this.missionActive) return;
      this.engines.reset(this.audio);
    });

    events.on(GameEventTypes.MissionEnded, () => {
      this.missionActive = false;
      this.engines.reset(this.audio);
      this.inbound.reset();
      this.intensity.reset();
      this.audio.setCockpitMode(false);
      this.audio.stopMusic(800);
    });

    events.on(GameEventTypes.MenuOpened, () => {
      this.missionActive = false;
      this.engines.reset(this.audio);
      this.audio.setCockpitMode(false);
      this.audio.playMusic(MusicTrackIds.MenuLoop, { fadeInMs: 400 });
    });
  }

  update(dt: number, context?: GameAudioUpdateContext): void {
    this.audio.update(dt);

    if (!this.missionActive || !context) return;

    this.audio.setCockpitMode(context.cockpitView);

    this.audio.updateListener(
      context.listenerPosition,
      context.listenerVelocity,
    );

    const intensity = this.intensity.update(dt, context);
    if (this.audio.isDynamicMusicActive()) {
      this.audio.setMusicIntensity(intensity, dt);
    }

    this.engines.update(
      this.audio,
      context.playerSpeedRatio,
      context.playerPosition,
      context.playerVelocity,
      context.npcEngines,
    );
  }

  processInbound(
    world: Parameters<InboundFlybyDetector["update"]>[0],
    listenerPos: Vector3,
    playerFaction: import("../combat/faction").FactionId,
  ): void {
    if (!this.missionActive) return;
    const cues = this.inbound.update(world, listenerPos, playerFaction);
    for (const cue of cues) {
      this.audio.playOneShot(cue.clipId, {
        position: cue.position,
        velocity: cue.velocity,
      });
    }
  }

  applySettings(
    master: number,
    music: number,
    sfx: number,
    muted: boolean,
  ): void {
    this.audio.setMasterVolume(master);
    this.audio.setMusicVolume(music);
    this.audio.setSfxVolume(sfx);
    this.audio.setMuted(muted);
  }
}
