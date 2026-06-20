import { TransformNode } from "@babylonjs/core";
import {
  resetShipAnimations,
  type LoadedEntity,
  type ShipManifestEntry,
} from "@rogue-leader/engine";
import type { FactionId } from "../../../combat/faction";
import type { CombatTeam } from "../../../combat/weapons/combat-team";
import type { VehicleWeaponSystem } from "../../../combat/weapons/vehicle-weapon-system";
import {
  resolveShipFlightStats,
  type ShipFlightStatsConfig,
} from "../../../config/loaders/ship-flight-stats";
import { ShipFlightController } from "../../../flight/ship-flight-controller";
import { ShipSfoilController } from "../../../flight/ship-sfoil-controller";
import type { ColliderComponent } from "../../components/collider-component";
import type { FlightComponent } from "../../components/flight-component";
import type { LodComponent } from "../../components/lod-component";
import type { ShipIdentityComponent } from "../../components/ship-identity-component";
import type { SfoilComponent } from "../../components/sfoil-component";
import type { WeaponsComponent } from "../../components/weapons-component";
import type { EntityId } from "../../entity-id";
import type { World } from "../../world";

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
  resetShipAnimations(options.loaded, options.shipEntry);
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
