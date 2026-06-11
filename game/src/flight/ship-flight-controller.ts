import { Quaternion, Scalar, TransformNode, Vector3 } from '@babylonjs/core';
import type { VehicleInput } from '../input/vehicle-input';
import {
  applyAutoRoll,
  DEFAULT_FLIGHT_ASSIST,
  hasFlightControlInput,
  ROLL_IDLE_DELAY_SEC,
  type FlightAssistOptions,
} from './flight-assist';
import { MIN_FLIGHT_SPEED } from './flight-constants';
import type { ResolvedShipFlightStats } from '../config/ship-flight-stats';
import { computeRogueFlightAxes } from './rogue-flight-controls';
import { applySoftBoundary, type SoftBoundary } from './soft-boundary';
import { getShipForward } from './ship-forward';

/** Shared Rogue-style flight kinematics for player and NPC ships. */
export class ShipFlightController {
  readonly velocity = Vector3.Zero();
  private speed: number;
  private readonly forward = new Vector3(0, 0, 1);
  private flightAssist: FlightAssistOptions = { ...DEFAULT_FLIGHT_ASSIST };
  private rollIdleTime = 0;

  constructor(
    public readonly root: TransformNode,
    private readonly stats: ResolvedShipFlightStats
  ) {
    this.speed = stats.minSpeed * 1.4;
  }

  setFlightAssist(options: Partial<FlightAssistOptions>): void {
    this.flightAssist = { ...this.flightAssist, ...options };
  }

  update(dt: number, input: VehicleInput, boundary?: SoftBoundary): void {
    const rot = this.root.rotationQuaternion ?? Quaternion.Identity();
    const { pitchAxis, yawAxis, rollAxis } = computeRogueFlightAxes(rot);

    const pitchQ = Quaternion.RotationAxis(pitchAxis, input.pitch * dt * this.stats.pitchRate);
    const yawQ = Quaternion.RotationAxis(yawAxis, input.yaw * dt * this.stats.yawRate);
    const rollQ = Quaternion.RotationAxis(rollAxis, -input.roll * dt * this.stats.rollRate);
    let newRot = pitchQ.multiply(yawQ).multiply(rollQ).multiply(rot).normalize();

    if (hasFlightControlInput(input)) {
      this.rollIdleTime = 0;
    } else if (this.flightAssist.autoRoll) {
      this.rollIdleTime += dt;
      if (this.rollIdleTime >= ROLL_IDLE_DELAY_SEC) {
        newRot = applyAutoRoll(newRot, dt);
      }
    }

    this.root.rotationQuaternion = newRot;

    const fwdAfterRot = getShipForward(this.root.rotationQuaternion);
    const cap = this.stats.maxSpeed * (input.boost ? this.stats.boostMultiplier : 1);

    if (input.throttle > 0) {
      this.speed += input.throttle * this.stats.thrustRate * dt;
    } else if (input.throttle < 0) {
      this.speed += input.throttle * this.stats.brakeRate * dt;
    }

    this.speed = Scalar.Clamp(this.speed, this.stats.minSpeed, cap);
    this.velocity.copyFrom(fwdAfterRot.scale(this.speed));
    this.root.position.addInPlace(this.velocity.scale(dt));

    if (boundary) {
      applySoftBoundary(this.root, boundary, dt);
    }

    this.forward.copyFrom(fwdAfterRot);
  }

  getForward(): Vector3 {
    return this.forward.clone();
  }

  getSpeed(): number {
    return this.speed;
  }

  getCruiseSpeed(): number {
    return this.stats.cruiseSpeed;
  }
}
