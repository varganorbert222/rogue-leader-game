import { buildSphereBody, type SphereBody } from '../../../collision/collision-system';
import { ActorRegistry } from '../../../actors/actor-registry';
import { AsteroidField } from '../../../hazards/asteroid-field';
import type { LodRuntimeState } from '@rogue-leader/engine';
import type { VehicleWeaponSystem } from '../../../combat/weapons/vehicle-weapon-system';

/**
 * Live mission scene: actors (ships) and environmental hazards (asteroids).
 * Single query surface for combat collision, LOD, and weapon systems.
 */
export class MissionWorld {
  readonly actors = new ActorRegistry();
  readonly hazards = new AsteroidField();

  collectVehicleWeaponSystems(): VehicleWeaponSystem[] {
    const systems = this.actors.npcActors.map((npc) => npc.vehicle.weapons);
    if (this.actors.player) {
      systems.push(this.actors.player.vehicle.weapons);
    }
    return systems;
  }

  collectProjectileTargetBodies(): SphereBody[] {
    const targets = this.actors.collectActorSphereBodies();

    for (const asteroid of this.hazards.asteroids) {
      targets.push(
        buildSphereBody({
          id: asteroid.id,
          position: asteroid.root.position,
          radius: asteroid.colliderRadius,
          team: 'neutral',
          faction: 'neutral',
          colliderMeshes: asteroid.colliderMeshes,
        }),
      );
    }

    return targets;
  }

  collectLodRuntimes(): LodRuntimeState[] {
    const states: LodRuntimeState[] = [];
    for (const actor of this.actors.allActors()) {
      states.push(actor.vehicle.lodRuntime);
    }
    states.push(...this.hazards.collectLodRuntimes());
    return states;
  }

  updateHazards(dt: number): void {
    this.hazards.update(dt);
  }

  dispose(): void {
    this.hazards.dispose();
    this.actors.clear();
  }
}
