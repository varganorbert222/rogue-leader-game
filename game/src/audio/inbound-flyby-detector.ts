import { Vector3 } from "@babylonjs/core";
import type { World } from "../ecs/world";
import { Role } from "../ecs/components/role-tag";
import { areFactionsHostile } from "../combat/faction";
import type { FactionId } from "../combat/faction";
import {
  getShipVelocity,
  getShipWorldPosition,
} from "../ecs/queries/ship-queries";
import { ShipAudioCatalog } from "./ship-audio-map";
import type { SfxClipId } from "../data/constants/audio-clips";

const INBOUND_TRIGGER_RANGE = 50;
const INBOUND_RESET_RANGE = 50;
const MIN_CLOSING_SPEED = 5;

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
    listenerPos: Vector3,
    playerFaction: FactionId,
  ): ShipInboundCue[] {
    const cues: ShipInboundCue[] = [];
    const activeIds = new Set<string>();

    for (const npcId of world.queryByRole(Role.Npc)) {
      const health = world.get(npcId, "health");
      const faction = world.get(npcId, "faction");
      const shipIdentity = world.get(npcId, "shipIdentity");
      if (
        !health ||
        health.isDead() ||
        faction === undefined ||
        !shipIdentity ||
        !world.has(npcId, "flight")
      ) {
        continue;
      }
      if (!areFactionsHostile(playerFaction, faction)) continue;

      const inboundClip = ShipAudioCatalog.inboundClipForShip(
        shipIdentity.shipId,
      );
      if (!inboundClip) continue;

      activeIds.add(npcId);
      const npcPos = getShipWorldPosition(world, npcId);
      const toListener = listenerPos.clone().subtract(npcPos);
      const dist = toListener.length();

      let entry = this.state.get(npcId);
      if (!entry) {
        entry = { triggered: false };
        this.state.set(npcId, entry);
      }

      if (dist > INBOUND_RESET_RANGE) {
        entry.triggered = false;
        continue;
      }

      if (entry.triggered || dist > INBOUND_TRIGGER_RANGE) continue;

      const npcVel = getShipVelocity(world, npcId);
      const closingSpeed = Vector3.Dot(npcVel, toListener.normalize());
      if (closingSpeed < MIN_CLOSING_SPEED) continue;

      entry.triggered = true;
      cues.push({
        npcId,
        shipId: shipIdentity.shipId,
        clipId: inboundClip,
        position: npcPos.clone(),
        velocity: npcVel.clone(),
      });
    }

    for (const id of this.state.keys()) {
      if (!activeIds.has(id)) this.state.delete(id);
    }

    return cues;
  }
}
