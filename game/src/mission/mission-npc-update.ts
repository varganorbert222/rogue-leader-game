import { Vector3, type Scene } from "@babylonjs/core";
import { computeFlockCenter } from "../ai/boid-forces";
import { updateWeaponAimForObserver } from "../combat/weapon-aim-controller";
import type { CombatConfig } from "../data/config/combat-config";
import type { NpcBehaviorConfig } from "../data/config/npc-behavior-config";
import type { NpcActor } from "../actors/npc-actor";
import type { PlayerActor } from "../actors/player-actor";
import type { ActorWorld } from "../actors/actor-world";
import { getShipForward } from "../flight/ship-forward";
import type { CombatSystem } from "../weapons/combat-system";

export interface MissionNpcUpdateContext {
  scene: Scene;
  world: ActorWorld;
  combat: CombatSystem;
  combatConfig: CombatConfig;
  npcBehaviorConfig: NpcBehaviorConfig;
}

export function updateMissionNpcs(
  ctx: MissionNpcUpdateContext,
  dt: number,
  player: PlayerActor,
  boundary?: { center: Vector3; radius: number },
): void {
  const playerPos = player.vehicle.position;
  const playerVel = player.vehicle.velocity;

  const flockMembers = new Map<string, NpcActor[]>();
  for (const npc of ctx.world.npcActors) {
    const members = flockMembers.get(npc.flockId) ?? [];
    members.push(npc);
    flockMembers.set(npc.flockId, members);
  }

  const flockCenters = new Map<string, Vector3>();
  for (const [flockId, members] of flockMembers) {
    flockCenters.set(
      flockId,
      computeFlockCenter(members.map((npc) => npc.vehicle.position)),
    );
  }

  for (const npc of ctx.world.npcActors) {
    const flock = flockMembers.get(npc.flockId) ?? [];
    const flockMates = flock
      .filter((mate) => mate.id !== npc.id)
      .map((mate) => ({
        id: mate.id,
        position: mate.vehicle.position,
        velocity: mate.vehicle.velocity,
        radius: mate.vehicle.colliderRadius,
      }));

    const wantsFire = npc.updateSteering({
      dt,
      playerPosition: playerPos,
      playerVelocity: playerVel,
      flockMates,
      flockCenter: flockCenters.get(npc.flockId) ?? npc.vehicle.position,
      boundary,
    });

    const enemyForward = getShipForward(npc.vehicle.rotationQuaternion);
    updateWeaponAimForObserver({
      scene: ctx.scene,
      combat: ctx.combat,
      weapons: npc.vehicle.weapons,
      observerId: npc.id,
      observerFaction: npc.faction,
      observerPos: npc.vehicle.position,
      observerVel: npc.vehicle.velocity,
      aimAxis: enemyForward,
      candidates: [player.toTargetEntity()],
      targeting: ctx.combatConfig.targeting,
      radarRadius: ctx.npcBehaviorConfig.radarRadius,
      dt,
      mode: "radar",
      targetingSystem: npc.targeting,
    });

    if (wantsFire) {
      ctx.combat.tryFireAtTarget(
        npc.vehicle.weapons,
        npc.vehicle.combatTeam,
        npc.faction,
        npc.id,
        playerPos,
        playerVel,
        npc.vehicle.velocity,
        ctx.combatConfig.targeting,
        ctx.npcBehaviorConfig.fireRange,
      );
    }
  }
}
