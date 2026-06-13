import { Vector3 } from '@babylonjs/core';
import type { AudioManager } from '@rogue-leader/engine';
import type { SfxClipId } from '../data/constants/audio-clips';
import { ShipAudioCatalog } from './ship-audio-map';
import {
  enginePitchFromSpeedRatio,
  resolveEngineAudioConfig,
  type EngineAudioConfig,
} from './engine-audio-config';

export interface ShipEngineAudioSource {
  id: string;
  shipId: string;
  position: Vector3;
  velocity: Vector3;
  /** 0–1 between min and max ship speed. */
  speedRatio: number;
}

/** Player + NPC engine loops — volume from 3D spatial only, pitch from speed. */
export class ShipEngineAudioManager {
  private playerHandle = '';
  private playerClipId: SfxClipId | null = null;
  private playerPosition = Vector3.Zero();
  private playerVelocity = Vector3.Zero();
  private config: EngineAudioConfig = resolveEngineAudioConfig();
  private readonly npcLoops = new Map<string, { handle: string; clipId: SfxClipId }>();

  setConfig(config: Partial<EngineAudioConfig>): void {
    this.config = resolveEngineAudioConfig(config);
  }

  reset(audio: AudioManager): void {
    this.stopPlayer(audio);
    this.stopAllNpcs(audio);
    this.playerClipId = null;
  }

  setPlayerShip(shipId: string): void {
    this.playerClipId = ShipAudioCatalog.engineClipForShip(shipId);
  }

  update(
    audio: AudioManager,
    playerSpeedRatio: number,
    playerPosition: Vector3,
    playerVelocity: Vector3,
    npcSources: readonly ShipEngineAudioSource[]
  ): void {
    this.playerPosition.copyFrom(playerPosition);
    this.playerVelocity.copyFrom(playerVelocity);
    this.updatePlayerLoop(audio, playerSpeedRatio);
    this.updateNpcLoops(audio, npcSources);
  }

  private updatePlayerLoop(audio: AudioManager, speedRatio: number): void {
    const clipId = this.playerClipId;
    if (!clipId) return;

    const pitch = enginePitchFromSpeedRatio(speedRatio, this.config);
    const transform = {
      pitch,
      position: this.playerPosition,
      velocity: this.playerVelocity,
    };

    if (!this.playerHandle) {
      this.playerHandle = audio.startLoop(clipId, {
        pitch,
        position: this.playerPosition.clone(),
        velocity: this.playerVelocity.clone(),
      });
      return;
    }

    audio.setLoopTransform(this.playerHandle, transform);
  }

  private updateNpcLoops(
    audio: AudioManager,
    sources: readonly ShipEngineAudioSource[]
  ): void {
    const activeIds = new Set<string>();

    for (const source of sources) {
      activeIds.add(source.id);
      const clipId = ShipAudioCatalog.engineClipForShip(source.shipId);
      const pitch = enginePitchFromSpeedRatio(source.speedRatio, this.config);
      const transform = {
        pitch,
        position: source.position,
        velocity: source.velocity,
      };

      const existing = this.npcLoops.get(source.id);
      if (!existing) {
        const handle = audio.startLoop(clipId, {
          pitch,
          position: source.position.clone(),
          velocity: source.velocity.clone(),
        });
        if (!handle) continue;
        this.npcLoops.set(source.id, { handle, clipId });
        continue;
      }

      if (existing.clipId !== clipId) {
        audio.stopLoop(existing.handle);
        const handle = audio.startLoop(clipId, {
          pitch,
          position: source.position.clone(),
          velocity: source.velocity.clone(),
        });
        if (!handle) {
          this.npcLoops.delete(source.id);
          continue;
        }
        this.npcLoops.set(source.id, { handle, clipId });
        continue;
      }

      audio.setLoopTransform(existing.handle, transform);
    }

    for (const [id, loop] of this.npcLoops.entries()) {
      if (activeIds.has(id)) continue;
      audio.stopLoop(loop.handle);
      this.npcLoops.delete(id);
    }
  }

  private stopPlayer(audio: AudioManager): void {
    if (!this.playerHandle) return;
    audio.stopLoop(this.playerHandle);
    this.playerHandle = '';
  }

  private stopAllNpcs(audio: AudioManager): void {
    for (const loop of this.npcLoops.values()) {
      audio.stopLoop(loop.handle);
    }
    this.npcLoops.clear();
  }
}
