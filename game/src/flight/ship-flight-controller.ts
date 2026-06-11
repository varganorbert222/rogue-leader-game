import { Quaternion, Scalar, TransformNode, Vector3 } from '@babylonjs/core';
import type { VehicleInput } from '../input/vehicle-input';
import {
  AngularRateSmoother,
  DEFAULT_ANGULAR_DYNAMICS,
} from './angular-dynamics';
import {
  canAutoRoll,
  DEFAULT_FLIGHT_ASSIST,
  getShortestRollToLevelAngle,
  hasFlightControlInput,
  AUTO_ROLL_RATE,
  ROLL_IDLE_DELAY_SEC,
  type FlightAssistOptions,
} from './flight-assist';
import type { ResolvedShipFlightStats } from '../config/ship-flight-stats';
import { computeRogueFlightAxes } from './rogue-flight-controls';
import { applySoftBoundary, type SoftBoundary } from './soft-boundary';
import { getShipForward } from './ship-forward';

/** P gain for auto-roll: error (rad) → commanded roll rate (rad/s). */
const AUTO_ROLL_KP = 2.8;

/** Shared Rogue-style flight kinematics for player and NPC ships. */
export class ShipFlightController {
  readonly velocity = Vector3.Zero();
  private speed: number;
  private readonly forward = new Vector3(0, 0, 1);
  private flightAssist: FlightAssistOptions = { ...DEFAULT_FLIGHT_ASSIST };
  private rollIdleTime = 0;
  private readonly angular = new AngularRateSmoother();

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

    let targetPitch = input.pitch * this.stats.pitchRate;
    let targetYaw = input.yaw * this.stats.yawRate;
    let targetRoll = -input.roll * this.stats.rollRate;

    if (hasFlightControlInput(input)) {
      this.rollIdleTime = 0;
    } else {
      this.rollIdleTime += dt;
      if (
        this.flightAssist.autoRoll &&
        this.rollIdleTime >= ROLL_IDLE_DELAY_SEC &&
        canAutoRoll(rot)
      ) {
        const rollError = getShortestRollToLevelAngle(rot);
        targetRoll = Scalar.Clamp(
          rollError * AUTO_ROLL_KP,
          -AUTO_ROLL_RATE,
          AUTO_ROLL_RATE
        );
      }
    }

    const rates = this.angular.step(
      dt,
      targetPitch,
      targetYaw,
      targetRoll,
      DEFAULT_ANGULAR_DYNAMICS
    );

    const pitchQ = Quaternion.RotationAxis(pitchAxis, rates.pitch * dt);
    const yawQ = Quaternion.RotationAxis(yawAxis, rates.yaw * dt);
    const rollQ = Quaternion.RotationAxis(rollAxis, rates.roll * dt);
    const newRot = pitchQ.multiply(yawQ).multiply(rollQ).multiply(rot).normalize();

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
