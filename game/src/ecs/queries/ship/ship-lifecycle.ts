import { Quaternion } from "@babylonjs/core";
import { prepareLoadedEntityForPool } from "@rogue-leader/engine";
import { disposePlayerCockpit } from "../../services/player-cockpit-service";
import type { EntityId } from "../../entity-id";
import type { World } from "../../world";
import { getShipRoot } from "./ship-accessors";

export function prepareShipForPool(world: World, id: EntityId): void {
  const flight = world.get(id, "flight");
  const weapons = world.get(id, "weapons");
  const ship = world.get(id, "shipIdentity");
  if (!flight || !weapons || !ship) return;

  world.get(id, "sfoil")?.controller.dispose();
  world.removeComponent(id, "sfoil");

  weapons.system.setFireEnabled(false);
  flight.controller.resetKinematics();
  flight.visualBankYaw = 0;
  flight.visualBankYawVel = 0;
  if (flight.bankPivot) {
    flight.bankPivot.rotationQuaternion = Quaternion.Identity();
  }
  const root = flight.controller.root;
  root.rotationQuaternion = Quaternion.Identity();
  root.rotation.setAll(0);
  prepareLoadedEntityForPool(ship.loadedEntity);
  root.position.set(0, -5000, 0);
}

export function disposeShipEntity(world: World, id: EntityId): void {
  disposePlayerCockpit(world, id);
  world.get(id, "sfoil")?.controller.dispose();
  if (world.has(id, "flight")) {
    getShipRoot(world, id).dispose();
  }
  world.despawn(id);
}
