import { Quaternion, Scalar, Vector3 } from "@babylonjs/core";
import { degToRad, smoothDampedScalar } from "@rogue-leader/engine";
import { type FlightAssistOptions } from "../../../flight/flight-assist";
import {
  YAW_VISUAL_BANK_DEG,
  YAW_VISUAL_BANK_SMOOTH_STICK_TIME,
} from "../../../flight/flight-constants";
import type { SoftBoundary } from "../../../flight/soft-boundary";
import type { VehicleInput } from "../../../player/input/vehicle-input";
import type { FlightComponent } from "../../components/flight-component";
import type { EntityId } from "../../entity-id";
import type { World } from "../../world";

const YAW_VISUAL_BANK_RAD = degToRad(YAW_VISUAL_BANK_DEG);

export function getVisualBankAngle(flight: FlightComponent): number {
  return flight.visualBankYaw * YAW_VISUAL_BANK_RAD;
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

export function applyShipCollisionResponse(
  world: World,
  id: EntityId,
  separation: Vector3,
  relativeApproachSpeed: number,
  velocityDelta?: Vector3,
): void {
  const flight = world.get(id, "flight");
  if (!flight) return;

  flight.controller.root.position.addInPlace(separation);
  flight.controller.applyCollisionResponse(
    separation.normalizeToNew(),
    relativeApproachSpeed,
    velocityDelta,
  );
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
