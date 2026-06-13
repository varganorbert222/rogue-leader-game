import type { Vector3 } from '@babylonjs/core';
import type { AudioManager, PlayOneShotOptions } from '@rogue-leader/engine';
import {
  EntityDestroyKinds,
  Factions,
  MusicTrackIds,
  SfxClipIds,
  DEFAULT_PLAYER_SHIP_ID,
  DamageSeverities,
} from '../constants';
import {
  GameEventPayloadKeys,
  GameEventTypes,
  readPayloadDestroyKind,
  readPayloadSfx,
  readPayloadString,
  readPayloadStringArray,
  readPayloadVector3,
  type GameEventBus,
} from '../events/game-events';
import {
  CombatIntensityTracker,
  type CombatIntensitySnapshot,
} from './combat-intensity';
import { InboundFlybyDetector } from './inbound-flyby-detector';
import { ShipAudioCatalog } from './ship-audio-map';
import {
  ShipEngineAudioManager,
  type ShipEngineAudioSource,
} from './ship-engine-audio';
import { resolveEngineAudioConfig } from './engine-audio-config';

export type { ShipEngineAudioSource } from './ship-engine-audio';

export interface GameAudioUpdateContext extends CombatIntensitySnapshot {
  listenerPosition: Vector3;
  listenerVelocity: Vector3;
  playerPosition: Vector3;
  playerVelocity: Vector3;
  playerSpeedRatio: number;
  npcEngines: ShipEngineAudioSource[];
}

function spatialOptions(
  payload: Record<string, unknown> | undefined,
  extra?: Partial<PlayOneShotOptions>
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
    events: GameEventBus
  ) {
    events.on(GameEventTypes.WeaponFired, (e) => {
      const configured = readPayloadString(e.payload, GameEventPayloadKeys.Sfx);
      const faction =
        readPayloadString(e.payload, GameEventPayloadKeys.Faction) ?? Factions.Rebel;
      const clipId = configured ?? ShipAudioCatalog.cannonFireClipForFaction(faction);
      this.audio.playOneShot(clipId, spatialOptions(e.payload));
    });

    events.on(GameEventTypes.ProjectileHit, (e) => {
      this.audio.playOneShot(
        readPayloadSfx(e.payload, SfxClipIds.BulletHit),
        spatialOptions(e.payload)
      );
    });

    events.on(GameEventTypes.ProjectileWhoosh, (e) => {
      this.audio.playOneShot(SfxClipIds.BulletWhoosh, spatialOptions(e.payload));
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
        spatialOptions(e.payload, { volume: 0.55 })
      );
    });

    events.on(GameEventTypes.PlayerDamaged, (e) => {
      this.intensity.notifyDamage(DamageSeverities.Hull);
      this.audio.playOneShot(
        SfxClipIds.BulletHit,
        spatialOptions(e.payload, { volume: 0.7 })
      );
    });

    events.on(GameEventTypes.MeteorImpact, (e) => {
      this.intensity.notifyDamage(DamageSeverities.Meteor);
      this.audio.playOneShot(
        SfxClipIds.AsteroidExplosion,
        spatialOptions(e.payload)
      );
    });

    events.on(GameEventTypes.SfoilToggled, (e) => {
      const files = readPayloadStringArray(e.payload, GameEventPayloadKeys.SfxFiles);
      const basePath = readPayloadString(e.payload, GameEventPayloadKeys.SfxBasePath);
      if (files?.length && basePath) {
        this.audio.playRandomFile(basePath, files, spatialOptions(e.payload));
        return;
      }

      const clipIds = readPayloadStringArray(e.payload, GameEventPayloadKeys.SfxClipIds);
      if (clipIds?.length) {
        const clipId = clipIds[Math.floor(Math.random() * clipIds.length)];
        this.audio.playOneShot(clipId, spatialOptions(e.payload));
        return;
      }

      const clip =
        readPayloadString(e.payload, GameEventPayloadKeys.Sfx) ?? SfxClipIds.XwingSfoil;
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
      this.engines.setConfig(resolveEngineAudioConfig(this.audio.getEngineAudioConfig()));

      const musicSetId = readPayloadString(e.payload, GameEventPayloadKeys.MusicSetId);
      const musicId =
        readPayloadString(e.payload, GameEventPayloadKeys.MusicId) ??
        MusicTrackIds.AsteroidFieldCombat;
      if (musicSetId && this.audio.startMusicSet(musicSetId)) return;
      this.audio.crossfadeMusic(musicId, 1200);
    });

    events.on(GameEventTypes.MissionEnded, () => {
      this.missionActive = false;
      this.engines.reset(this.audio);
      this.inbound.reset();
      this.intensity.reset();
      this.audio.stopMusic(800);
    });

    events.on(GameEventTypes.MenuOpened, () => {
      this.missionActive = false;
      this.engines.reset(this.audio);
      this.audio.playMusic(MusicTrackIds.MenuLoop, { fadeInMs: 400 });
    });
  }

  update(dt: number, context?: GameAudioUpdateContext): void {
    if (!this.missionActive || !context) return;

    this.audio.updateListener(context.listenerPosition, context.listenerVelocity);

    const intensity = this.intensity.update(dt, context);
    if (this.audio.isDynamicMusicActive()) {
      this.audio.setMusicIntensity(intensity, dt);
    }

    this.engines.update(
      this.audio,
      context.playerSpeedRatio,
      context.playerPosition,
      context.playerVelocity,
      context.npcEngines
    );
  }

  processInbound(
    npcs: Parameters<InboundFlybyDetector['update']>[0],
    playerPos: Vector3,
    playerFaction: import('../combat/faction').FactionId
  ): void {
    if (!this.missionActive) return;
    const cues = this.inbound.update(npcs, playerPos, playerFaction);
    for (const cue of cues) {
      this.audio.playOneShot(cue.clipId, {
        position: cue.position,
        velocity: cue.velocity,
      });
    }
  }

  applySettings(master: number, music: number, sfx: number, muted: boolean): void {
    this.audio.setMasterVolume(master);
    this.audio.setMusicVolume(music);
    this.audio.setSfxVolume(sfx);
    this.audio.setMuted(muted);
  }
}
