import type { FactionId } from '../combat/faction';
import { isAutoAimCandidate } from '../combat/faction';
import type { TargetEntity } from '../combat/targeting-system';
import type { SphereBody } from '../collision/collision-system';
import type { Actor } from './actor';
import { NpcActor } from './npc-actor';
import { PlayerActor } from './player-actor';

/** Registry of player + NPC actors in the active mission. */
export class ActorWorld {
  player?: PlayerActor;
  private readonly npcs: NpcActor[] = [];

  get npcActors(): readonly NpcActor[] {
    return this.npcs;
  }

  allActors(): Actor[] {
    const actors: Actor[] = [...this.npcs];
    if (this.player) actors.unshift(this.player);
    return actors;
  }

  addNpc(npc: NpcActor): void {
    this.npcs.push(npc);
  }

  removeNpc(id: string): void {
    const index = this.npcs.findIndex((npc) => npc.id === id);
    if (index >= 0) {
      this.npcs.splice(index, 1);
    }
  }

  findActor(id: string): Actor | undefined {
    if (this.player?.id === id) return this.player;
    return this.npcs.find((npc) => npc.id === id);
  }

  collectHostileTargets(observerFaction: FactionId): TargetEntity[] {
    return this.npcs
      .filter((npc) => isAutoAimCandidate(observerFaction, npc.faction))
      .map((npc) => npc.toTargetEntity());
  }

  collectActorSphereBodies(): SphereBody[] {
    const bodies: SphereBody[] = this.npcs.map((npc) => npc.toSphereBody());
    if (this.player) {
      bodies.push(this.player.toSphereBody());
    }
    return bodies;
  }

  getNpcCount(): number {
    return this.npcs.length;
  }

  clear(): void {
    this.player = undefined;
    this.npcs.length = 0;
  }
}
