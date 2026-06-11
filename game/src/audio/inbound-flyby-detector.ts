import { Vector3 } from '@babylonjs/core';
import type { NpcActor } from '../actors/npc-actor';
import { areFactionsHostile } from '../combat/faction';
import type { FactionId } from '../combat/faction';
import { ShipAudioCatalog } from './ship-audio-map';
import type { SfxClipId } from '../constants/audio-clips';

const INBOUND_TRIGGER_RANGE = 155;
const INBOUND_RESET_RANGE = 240;
const MIN_CLOSING_SPEED = 22;

interface InboundState {
  triggered: boolean;
}

export interface ShipInboundCue {
  npcId: string;
  shipId: string;
  clipId: SfxClipId;
  position: Vector3;
  velocity: Vector3;
}

/** One-shot inbound flyby when a hostile ship closes on the player. */
export class InboundFlybyDetector {
  private readonly state = new Map<string, InboundState>();

  update(
    npcs: readonly NpcActor[],
    playerPos: Vector3,
    playerFaction: FactionId
  ): ShipInboundCue[] {
    const cues: ShipInboundCue[] = [];
    const activeIds = new Set<string>();

    for (const npc of npcs) {
      if (npc.health.isDead()) continue;
      if (!areFactionsHostile(playerFaction, npc.faction)) continue;

      activeIds.add(npc.id);
      const toPlayer = playerPos.subtract(npc.vehicle.position);
      const dist = toPlayer.length();
      const inboundClip = ShipAudioCatalog.inboundClipForShip(npc.vehicle.shipId);
      if (!inboundClip) continue;

      let entry = this.state.get(npc.id);
      if (!entry) {
        entry = { triggered: false };
        this.state.set(npc.id, entry);
      }

      if (dist > INBOUND_RESET_RANGE) {
        entry.triggered = false;
        continue;
      }

      if (entry.triggered || dist > INBOUND_TRIGGER_RANGE) continue;

      const closingSpeed = Vector3.Dot(npc.vehicle.velocity, toPlayer.normalize());
      if (closingSpeed < MIN_CLOSING_SPEED) continue;

      entry.triggered = true;
      cues.push({
        npcId: npc.id,
        shipId: npc.vehicle.shipId,
        clipId: inboundClip,
        position: npc.vehicle.position.clone(),
        velocity: npc.vehicle.velocity.clone(),
      });
    }

    for (const id of this.state.keys()) {
      if (!activeIds.has(id)) this.state.delete(id);
    }

    return cues;
  }

  reset(): void {
    this.state.clear();
  }
}
