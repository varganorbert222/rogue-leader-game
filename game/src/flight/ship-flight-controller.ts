import { Quaternion, Scalar, TransformNode, Vector3 } from '@babylonjs/core';
import { smoothDampedScalar } from '@rogue-leader/engine';
import type { VehicleInput } from '../player/input/vehicle-input';
import {
  AngularRateSmoother,
  DEFAULT_ANGULAR_DYNAMICS,
} from './angular-dynamics';
import { FLIGHT_STICK_SMOOTH_TIME } from './flight-constants';
import {
  canAutoRoll,
  DEFAULT_FLIGHT_ASSIST,
  getShortestRollToLevelAngle,
  hasFlightControlInput,
  AUTO_ROLL_RATE,
  ROLL_IDLE_DELAY_SEC,
  type FlightAssistOptions,
} from './flight-assist';
import type { ResolvedShipFlightStats } from '../data/config/ship-flight-stats';
import { computeRogueFlightAxes } from './rogue-flight-controls';
import { applySoftBoundary, type SoftBoundary } from './soft-boundary';
import { getShipForward, shipRotationFromHeading } from './ship-forward';

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
  private rollStick = 0;
  private rollStickVel = 0;
  private speedCapMultiplier = 1;

  constructor(
    public readonly root: TransformNode,
    private readonly stats: ResolvedShipFlightStats
  ) {
    this.speed = stats.minSpeed * 1.4;
  }

  setFlightAssist(options: Partial<FlightAssistOptions>): void {
    this.flightAssist = { ...this.flightAssist, ...options };
  }

  setSpeedCapMultiplier(multiplier: number): void {
    this.speedCapMultiplier = Math.max(0.1, multiplier);
  }

  update(dt: number, input: VehicleInput, boundary?: SoftBoundary): void {
    const rot = this.root.rotationQuaternion ?? Quaternion.Identity();
    const { pitchAxis, yawAxis, rollAxis } = computeRogueFlightAxes(rot);

    const rollStick = smoothDampedScalar(
      this.rollStick,
      input.roll,
      this.rollStickVel,
      FLIGHT_STICK_SMOOTH_TIME,
      dt,
    );
    this.rollStick = rollStick.value;
    this.rollStickVel = rollStick.velocity;

    let targetPitch = input.pitch * this.stats.pitchRate;
    let targetYaw = input.yaw * this.stats.yawRate;
    let targetRoll = -this.rollStick * this.stats.rollRate;

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
    const cap =
      this.stats.maxSpeed *
      (input.boost ? this.stats.boostMultiplier : 1) *
      this.speedCapMultiplier;

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

  getMinSpeed(): number {
    return this.stats.minSpeed;
  }

  getMaxSpeed(): number {
    return this.stats.maxSpeed;
  }

  getCruiseSpeed(): number {
    return this.stats.cruiseSpeed;
  }

  /** Collision response — separation, bounce, and slide along the contact surface. */
  applyCollisionResponse(
    normalAwayFromOther: Vector3,
    relativeApproachSpeed: number,
    velocityDelta?: Vector3,
    slideBlend = 0.28,
  ): void {
    const impact = Math.max(0, relativeApproachSpeed);
    if (impact < 1e-3 && (!velocityDelta || velocityDelta.lengthSquared() < 1e-6)) {
      return;
    }

    if (velocityDelta && velocityDelta.lengthSquared() > 1e-6) {
      const postVel = this.velocity.add(velocityDelta);
      const rot = this.root.rotationQuaternion ?? Quaternion.Identity();
      const fwd = getShipForward(rot);
      const slideFwd = postVel.clone();
      slideFwd.y *= 0.25;
      if (slideFwd.lengthSquared() > 4) {
        const blended = fwd.add(slideFwd.normalize().scale(slideBlend)).normalize();
        this.root.rotationQuaternion = shipRotationFromHeading(blended);
      }
      const newSpeed = Math.max(
        this.stats.minSpeed * 0.55,
        postVel.length() * 0.92,
      );
      this.speed = Math.min(this.speed, newSpeed);
      this.velocity.copyFrom(getShipForward(rot).scale(this.speed));
      return;
    }

    const speedLoss = Math.min(this.speed * 0.55, impact * 0.65);
    this.speed = Math.max(this.stats.minSpeed * 0.75, this.speed - speedLoss);
    const idleRot = this.root.rotationQuaternion ?? Quaternion.Identity();
    this.velocity.copyFrom(getShipForward(idleRot).scale(this.speed));
  }

  resetKinematics(): void {
    this.velocity.setAll(0);
    this.speed = this.stats.minSpeed * 1.4;
    this.rollIdleTime = 0;
    this.speedCapMultiplier = 1;
    this.angular.reset();
    this.rollStick = 0;
    this.rollStickVel = 0;
  }
}
