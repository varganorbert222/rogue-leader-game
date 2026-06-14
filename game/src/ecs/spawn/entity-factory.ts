import type { LoadedEntity, ShipManifestEntry } from '@rogue-leader/engine';
import type { FactionId } from '../../combat/faction';
import type { CombatTeam } from '../../combat/weapons/combat-team';
import type { VehicleWeaponSystem } from '../../combat/weapons/vehicle-weapon-system';
import type { ShipFlightStatsConfig } from '../../data/config/ship-flight-stats';
import { HealthComponent } from '../components/health-component';
import type { WeaponEnergyComponent } from '../components/weapon-energy-component';
import { Role } from '../components/role-tag';
import { createTargetingComponent } from '../components/targeting-component';
import type { NpcSteeringComponent } from '../components/npc-steering-component';
import {
  attachShipComponents,
  buildShipComponents,
  disposeShipEntity,
  replaceShipComponents,
  type BuiltShipComponents,
} from '../queries/ship-queries';
import type { World } from '../world';
import type { EntityId } from '../entity-id';

export interface ShipSpawnOptions {
  shipId: string;
  shipEntry: ShipManifestEntry;
  loaded: LoadedEntity;
  faction: FactionId;
  combatTeam: CombatTeam;
  weapons: VehicleWeaponSystem;
  flightDefaults?: ShipFlightStatsConfig;
}

export interface SpawnPlayerEntityOptions extends ShipSpawnOptions {
  id: string;
  health: HealthComponent;
  weaponEnergy: WeaponEnergyComponent;
}

export interface SpawnNpcEntityOptions extends ShipSpawnOptions {
  id: string;
  flockId: string;
  health: HealthComponent;
  steering: NpcSteeringComponent;
}

function spawnShipEntity(
  world: World,
  id: EntityId,
  options: ShipSpawnOptions,
): BuiltShipComponents {
  const built = buildShipComponents({
    shipId: options.shipId,
    shipEntry: options.shipEntry,
    loaded: options.loaded,
    faction: options.faction,
    combatTeam: options.combatTeam,
    weapons: options.weapons,
    flightDefaults: options.flightDefaults,
  });
  attachShipComponents(world, id, built);
  return built;
}

export function spawnPlayerEntity(
  world: World,
  options: SpawnPlayerEntityOptions,
): EntityId {
  const id = world.spawn(options.id);
  world.add(id, 'role', Role.Player);
  world.add(id, 'health', options.health);
  world.add(id, 'weaponEnergy', options.weaponEnergy);
  world.add(id, 'faction', options.faction);
  world.add(id, 'targeting', createTargetingComponent());
  spawnShipEntity(world, id, options);
  return id;
}

export function spawnNpcEntity(
  world: World,
  options: SpawnNpcEntityOptions,
): EntityId {
  const id = world.spawn(options.id);
  world.add(id, 'role', Role.Npc);
  world.add(id, 'health', options.health);
  world.add(id, 'faction', options.faction);
  world.add(id, 'targeting', createTargetingComponent());
  world.add(id, 'npcSteering', options.steering);
  spawnShipEntity(world, id, options);
  return id;
}

export function replacePlayerShip(
  world: World,
  built: BuiltShipComponents,
): void {
  const playerId = world.playerEntity;
  if (!playerId) return;
  replaceShipComponents(world, playerId, built);
}

export function disposeEntity(world: World, id: EntityId): void {
  if (world.has(id, 'flight')) {
    disposeShipEntity(world, id);
    return;
  }
  world.despawn(id);
}
