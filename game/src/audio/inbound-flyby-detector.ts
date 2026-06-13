import { Vector3 } from '@babylonjs/core';
import type { World } from '../ecs/world';
import { Role } from '../ecs/components/role-tag';
import { areFactionsHostile } from '../combat/faction';
import type { FactionId } from '../combat/faction';
import {
  getShipPosition,
  getShipVelocity,
} from '../ecs/queries/ship-queries';
import { ShipAudioCatalog } from './ship-audio-map';
import type { SfxClipId } from '../data/constants/audio-clips';

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

  reset(): void {
    this.state.clear();
  }

  update(
    world: World,
    playerPos: Vector3,
    playerFaction: FactionId,
  ): ShipInboundCue[] {
    const cues: ShipInboundCue[] = [];
    const activeIds = new Set<string>();

    for (const npcId of world.queryByRole(Role.Npc)) {
      const health = world.get(npcId, 'health');
      const faction = world.get(npcId, 'faction');
      const shipIdentity = world.get(npcId, 'shipIdentity');
      if (
        !health ||
        health.isDead() ||
        faction === undefined ||
        !shipIdentity ||
        !world.has(npcId, 'flight')
      ) {
        continue;
      }
      if (!areFactionsHostile(playerFaction, faction)) continue;

      activeIds.add(npcId);
      const st = this.state.get(npcId) ?? { triggered: false };
      this.state.set(npcId, st);

      const npcPos = getShipPosition(world, npcId);
      const npcVel = getShipVelocity(world, npcId);
      const toPlayer = playerPos.subtract(npcPos);
      const dist = toPlayer.length();
      const closingSpeed = Vector3.Dot(npcVel, toPlayer.normalize());

      if (dist > INBOUND_RESET_RANGE) {
        st.triggered = false;
      }

      if (
        !st.triggered &&
        dist <= INBOUND_TRIGGER_RANGE &&
        closingSpeed >= MIN_CLOSING_SPEED
      ) {
        st.triggered = true;
        const clipId = ShipAudioCatalog.inboundClipForShip(shipIdentity.shipId);
        if (clipId) {
          cues.push({
            npcId,
            shipId: shipIdentity.shipId,
            clipId,
            position: npcPos.clone(),
            velocity: npcVel.clone(),
          });
        }
      }
    }

    for (const id of [...this.state.keys()]) {
      if (!activeIds.has(id)) this.state.delete(id);
    }

    return cues;
  }
}
