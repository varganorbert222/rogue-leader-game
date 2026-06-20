import { Quaternion, type Scene, Vector3 } from "@babylonjs/core";
import {
  applyCockpitViewMode,
  composeShipVisualRotation,
} from "@rogue-leader/engine";
import type { TargetEntity } from "../../combat/targeting/targeting-system";
import { updateWeaponAimForObserver } from "../../combat/targeting/weapon-aim-controller";
import type { TargetingConfig } from "../../config/loaders/combat-config";
import type { CameraController } from "../../flight/camera-controller";
import { RETICLE_INNER_DISTANCE } from "../../flight/flight-constants";
import { projectWorldToScreen } from "../../flight/screen-project";
import { getShipForward } from "../../flight/ship-forward";
import type { SoftBoundary } from "../../flight/soft-boundary";
import type { PlayerInput } from "../../player/input/player-input";
import type { CombatSystem } from "../../combat/systems/combat-system";
import type { GameEventBus } from "../../core/events/game-events";
import { GameEvents } from "../../core/events/game-events";
import { sfoilSfxToEventPayload } from "../../audio/sfoil-sfx";
import {
  applyShipFlightInput,
  getShipForward as getEntityShipForward,
  getShipPosition,
  getShipRoot,
  getShipVelocity,
  getVisualBankAngle,
  hasSfoil,
  tryToggleSfoil,
} from "../../ecs/queries/ship-queries";
import type { World } from "../../ecs/world";
import type { EntityId } from "../../ecs/entity-id";

export interface PlayerSystemContext {
  world: World;
  playerId: EntityId;
  dt: number;
  scene: Scene;
  input: PlayerInput;
  boundary?: SoftBoundary;
  camera: CameraController;
  combat: CombatSystem;
  events: GameEventBus;
  targetingConfig: TargetingConfig;
  radarRadius: number;
  hostileTargets: TargetEntity[];
}

export function runPlayerSystem(ctx: PlayerSystemContext): void {
  const { world, playerId, input } = ctx;
  const faction = world.get(playerId, "faction");
  const targeting = world.get(playerId, "targeting");
  const weapons = world.get(playerId, "weapons");
  const shipIdentity = world.get(playerId, "shipIdentity");
  const cockpit = world.get(playerId, "cockpit");
  if (faction === undefined || !targeting || !weapons || !shipIdentity) return;

  const root = getShipRoot(world, playerId);
  const flight = world.get(playerId, "flight");
  applyShipFlightInput(world, playerId, ctx.dt, input.vehicle, ctx.boundary);
  const visualRot = composeShipVisualRotation(
    root.rotationQuaternion ?? Quaternion.Identity(),
    flight ? getVisualBankAngle(flight) : 0,
    flight?.invertForwardRoll ?? false,
  );
  ctx.camera.update(ctx.dt, root, input.camera, visualRot, input.vehicle);
  applyCockpitViewMode(
    shipIdentity.loadedEntity,
    cockpit?.attachment,
    ctx.camera.getMode() === "cockpit",
  );

  const shipPos = root.getAbsolutePosition();
  const shipForward = getShipForward(
    root.rotationQuaternion ?? Quaternion.Identity(),
  );

  const reticleInner = projectWorldToScreen(
    ctx.scene,
    shipPos.add(shipForward.scale(RETICLE_INNER_DISTANCE)),
  );

  const { debug } = updateWeaponAimForObserver({
    scene: ctx.scene,
    combat: ctx.combat,
    weapons: weapons.system,
    observerId: playerId,
    observerFaction: faction,
    observerPos: getShipPosition(world, playerId),
    observerVel: getShipVelocity(world, playerId),
    aimAxis: shipForward,
    candidates: ctx.hostileTargets,
    targeting: ctx.targetingConfig,
    radarRadius: ctx.radarRadius,
    dt: ctx.dt,
    mode: "screen",
    targetingSystem: targeting.system,
    reticle: reticleInner,
  });
  targeting.lastAimDebug = debug;

  const aim = getEntityShipForward(world, playerId);
  const weaponEnergy = world.get(playerId, "weaponEnergy");
  if (input.combat.fire) {
    ctx.combat.tryFirePrimary(
      weapons.system,
      shipIdentity.combatTeam,
      faction,
      playerId,
      aim,
      weaponEnergy,
    );
  }
  if (input.combat.fireSecondaryPressed) {
    ctx.combat.tryFireSecondary(
      weapons.system,
      shipIdentity.combatTeam,
      faction,
      playerId,
      aim,
      weaponEnergy,
    );
  }
  if (input.combat.toggleSfoilPressed && hasSfoil(world, playerId)) {
    const sfxRequest = tryToggleSfoil(world, playerId);
    if (sfxRequest) {
      ctx.events.emit(
        GameEvents.sfoilToggled({
          ...sfoilSfxToEventPayload(
            sfxRequest,
            getShipPosition(world, playerId).clone(),
          ),
        }),
      );
    }
  }
}
