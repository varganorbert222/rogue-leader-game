import { Quaternion, Scalar, TransformNode, Vector3 } from "@babylonjs/core";
import type { LoadedEntity, ShipManifestEntry } from "@rogue-leader/engine";
import {
  degToRad,
  smoothDampedScalar,
  prepareLoadedEntityForPool,
} from "@rogue-leader/engine";
import type { FactionId } from "../../combat/faction";
import { computeEngineSpeedRatio } from "../../audio/engine-audio-config";
import type { SfoilSfxPlayRequest } from "../../audio/sfoil-sfx";
import type { CombatTeam } from "../../combat/weapons/combat-team";
import type { VehicleWeaponSystem } from "../../combat/weapons/vehicle-weapon-system";
import {
  resolveShipFlightStats,
  type ShipFlightStatsConfig,
} from "../../data/config/ship-flight-stats";
import { type FlightAssistOptions } from "../../flight/flight-assist";
import {
  YAW_VISUAL_BANK_DEG,
  YAW_VISUAL_BANK_SMOOTH_STICK_TIME,
} from "../../flight/flight-constants";
import { ShipFlightController } from "../../flight/ship-flight-controller";
import type { SoftBoundary } from "../../flight/soft-boundary";
import type { VehicleInput } from "../../player/input/vehicle-input";
import { ShipSfoilController } from "../../flight/ship-sfoil-controller";
import type { ColliderComponent } from "../components/collider-component";
import type { FlightComponent } from "../components/flight-component";
import type { LodComponent } from "../components/lod-component";
import type { ShipIdentityComponent } from "../components/ship-identity-component";
import type { SfoilComponent } from "../components/sfoil-component";
import type { WeaponsComponent } from "../components/weapons-component";
import type { EntityId } from "../entity-id";
import { disposePlayerCockpit } from "../services/player-cockpit-service";
import type { World } from "../world";

const YAW_VISUAL_BANK_RAD = degToRad(YAW_VISUAL_BANK_DEG);

export function getVisualBankAngle(flight: FlightComponent): number {
  return flight.visualBankYaw * YAW_VISUAL_BANK_RAD;
}

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

export function setFlightAssist(
  world: World,
  id: EntityId,
  options: Partial<FlightAssistOptions>,
): void {
  world.get(id, "flight")?.controller.setFlightAssist(options);
}

export function applyShipFlightInput(
  world: World,
  id: EntityId,
  dt: number,
  input: VehicleInput,
  boundary?: SoftBoundary,
  visualYaw = input.yaw,
): void {
  const flight = world.get(id, "flight");
  if (!flight) return;

  updateVisualYawBank(flight, dt, visualYaw);
  flight.controller.update(dt, input, boundary);
}

function updateVisualYawBank(
  flight: FlightComponent,
  dt: number,
  yaw: number,
): void {
  if (!flight.bankPivot) return;

  const target = Scalar.Clamp(yaw, -1, 1);
  const damped = smoothDampedScalar(
    flight.visualBankYaw,
    target,
    flight.visualBankYawVel,
    YAW_VISUAL_BANK_SMOOTH_STICK_TIME,
    dt,
  );
  flight.visualBankYaw = damped.value;
  flight.visualBankYawVel = damped.velocity;

  const rollAngle =
    (flight.invertForwardRoll ? -1 : 1) *
    flight.visualBankYaw *
    YAW_VISUAL_BANK_RAD;
  flight.bankPivot.rotationQuaternion = Quaternion.RotationAxis(
    Vector3.Backward(),
    rollAngle,
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

export interface BuildShipComponentsOptions {
  shipId: string;
  shipEntry: ShipManifestEntry;
  loaded: LoadedEntity;
  faction: FactionId;
  combatTeam: CombatTeam;
  weapons: VehicleWeaponSystem;
  flightDefaults?: ShipFlightStatsConfig;
}

export interface BuiltShipComponents {
  shipIdentity: ShipIdentityComponent;
  flight: FlightComponent;
  collider: ColliderComponent;
  lod: LodComponent;
  weapons: WeaponsComponent;
  sfoil?: SfoilComponent;
}

export function buildShipComponents(
  options: BuildShipComponentsOptions,
): BuiltShipComponents {
  const stats = resolveShipFlightStats(
    options.shipEntry,
    options.flightDefaults,
  );
  const flightController = new ShipFlightController(options.loaded.root, stats);
  const bankPivot = setupVisualBankPivot(
    options.loaded.visualRoot,
    options.loaded.visual.invertForwardRoll,
  );
  const sfoilController = ShipSfoilController.tryCreate({
    shipEntry: options.shipEntry,
    animationGroups: options.loaded.animationGroups,
    weapons: options.weapons,
    flight: flightController,
  });

  const result: BuiltShipComponents = {
    shipIdentity: {
      shipId: options.shipId,
      combatTeam: options.combatTeam,
      loadedEntity: options.loaded,
    },
    flight: {
      controller: flightController,
      bankPivot,
      visualBankYaw: 0,
      visualBankYawVel: 0,
      invertForwardRoll: options.loaded.visual.invertForwardRoll,
    },
    collider: {
      radius: options.loaded.colliderRadius,
      meshes: options.loaded.colliderMeshes,
    },
    lod: { runtime: options.loaded.lodRuntime },
    weapons: { system: options.weapons },
  };

  if (sfoilController) {
    result.sfoil = { controller: sfoilController };
  }

  return result;
}

function setupVisualBankPivot(
  visualRoot: TransformNode,
  _invertForwardRoll: boolean,
): TransformNode | undefined {
  const existing = visualRoot
    .getChildTransformNodes(false)
    .find((node) => node.name.endsWith("_bank"));
  if (existing) return existing;

  const bank = new TransformNode(
    `${visualRoot.name}_bank`,
    visualRoot.getScene(),
  );
  bank.parent = visualRoot;
  for (const child of [...visualRoot.getChildren()]) {
    if (child !== bank) {
      child.parent = bank;
    }
  }
  return bank;
}

export function attachShipComponents(
  world: World,
  id: EntityId,
  built: BuiltShipComponents,
): void {
  world.add(id, "shipIdentity", built.shipIdentity);
  world.add(id, "flight", built.flight);
  world.add(id, "collider", built.collider);
  world.add(id, "lod", built.lod);
  world.add(id, "weapons", built.weapons);
  if (built.sfoil) {
    world.add(id, "sfoil", built.sfoil);
  }
}

export function replaceShipComponents(
  world: World,
  id: EntityId,
  built: BuiltShipComponents,
): void {
  world.get(id, "sfoil")?.controller.dispose();
  world.removeComponent(id, "sfoil");
  attachShipComponents(world, id, built);
}
