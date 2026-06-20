import { Quaternion, TransformNode, Vector3 } from "@babylonjs/core";
import { computeEngineSpeedRatio } from "../../../audio/engine-audio-config";
import type { SfoilSfxPlayRequest } from "../../../audio/sfoil-sfx";
import type { EntityId } from "../../entity-id";
import type { World } from "../../world";

export function isShipEntity(world: World, id: EntityId): boolean {
  return world.has(id, "flight") && world.has(id, "shipIdentity");
}

export function getShipRoot(world: World, id: EntityId): TransformNode {
  return world.get(id, "flight")!.controller.root;
}

export function getShipPosition(world: World, id: EntityId): Vector3 {
  return getShipRoot(world, id).position;
}

export function getShipWorldPosition(world: World, id: EntityId): Vector3 {
  return getShipRoot(world, id).getAbsolutePosition();
}

export function getShipVelocity(world: World, id: EntityId): Vector3 {
  return world.get(id, "flight")!.controller.velocity;
}

export function getShipRotation(world: World, id: EntityId): Quaternion {
  return getShipRoot(world, id).rotationQuaternion ?? Quaternion.Identity();
}

export function getShipForward(world: World, id: EntityId): Vector3 {
  return world.get(id, "flight")!.controller.getForward();
}

export function getShipSpeed(world: World, id: EntityId): number {
  return world.get(id, "flight")!.controller.getSpeed();
}

export function getShipCruiseSpeed(world: World, id: EntityId): number {
  return world.get(id, "flight")!.controller.getCruiseSpeed();
}

export function getEngineSpeedRatio(world: World, id: EntityId): number {
  const flight = world.get(id, "flight")!.controller;
  return computeEngineSpeedRatio(
    flight.getSpeed(),
    flight.getMinSpeed(),
    flight.getMaxSpeed(),
  );
}

export function hasSfoil(world: World, id: EntityId): boolean {
  return world.has(id, "sfoil");
}

export function tryToggleSfoil(
  world: World,
  id: EntityId,
): SfoilSfxPlayRequest | null {
  const sfoil = world.get(id, "sfoil");
  if (!sfoil?.controller.requestToggle()) return null;
  return sfoil.controller.sfxRequest;
}
