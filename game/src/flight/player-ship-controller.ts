import {
  Quaternion,
  Scalar,
  Vector3,
  type TransformNode,
} from "@babylonjs/core";
import type { FlightInput } from "../input/i-input-source";
import {
  applyAutoRoll,
  DEFAULT_FLIGHT_ASSIST,
  hasFlightControlInput,
  INPUT_DEADZONE,
  ROLL_IDLE_DELAY_SEC,
  type FlightAssistOptions,
} from "./flight-assist";
import {
  DEFAULT_BOOST_MULTIPLIER,
  DEFAULT_MAX_SPEED,
  MIN_FLIGHT_SPEED,
  YAW_VISUAL_BANK_DEG,
} from "./flight-constants";
import {
  computeRogueFlightAxes,
  ROGUE_PITCH_RATE,
  ROGUE_ROLL_RATE,
  ROGUE_YAW_RATE,
} from "./rogue-flight-controls";
import { applySoftBoundary, type SoftBoundary } from "./soft-boundary";
import { getShipForward } from "./ship-forward";

const YAW_VISUAL_BANK_RAD = (YAW_VISUAL_BANK_DEG * Math.PI) / 180;

export class PlayerShipController {
  readonly velocity = Vector3.Zero();
  private speed = MIN_FLIGHT_SPEED * 1.4;
  private readonly forward = new Vector3(0, 0, 1);
  private flightAssist: FlightAssistOptions = { ...DEFAULT_FLIGHT_ASSIST };
  private rollIdleTime = 0;
  private visualBank = 0;

  constructor(
    public readonly root: TransformNode,
    private readonly visualRoot?: TransformNode,
    private readonly maxSpeed = DEFAULT_MAX_SPEED,
    private readonly boostMultiplier = DEFAULT_BOOST_MULTIPLIER,
    private readonly minSpeed = MIN_FLIGHT_SPEED,
  ) {}

  setFlightAssist(options: Partial<FlightAssistOptions>): void {
    this.flightAssist = { ...this.flightAssist, ...options };
  }

  getFlightAssist(): FlightAssistOptions {
    return { ...this.flightAssist };
  }

  update(
    dt: number,
    input: FlightInput,
    boundary?: SoftBoundary,
  ): void {
    const rot = this.root.rotationQuaternion ?? Quaternion.Identity();
    const { pitchAxis, yawAxis, rollAxis } = computeRogueFlightAxes(rot);

    const pitchQ = Quaternion.RotationAxis(
      pitchAxis,
      input.pitch * dt * ROGUE_PITCH_RATE,
    );
    const yawQ = Quaternion.RotationAxis(
      yawAxis,
      input.yaw * dt * ROGUE_YAW_RATE,
    );
    const rollQ = Quaternion.RotationAxis(
      rollAxis,
      -input.roll * dt * ROGUE_ROLL_RATE,
    );
    let newRot = pitchQ
      .multiply(yawQ)
      .multiply(rollQ)
      .multiply(rot)
      .normalize();

    if (hasFlightControlInput(input)) {
      this.rollIdleTime = 0;
    } else if (this.flightAssist.autoRoll) {
      this.rollIdleTime += dt;
      if (this.rollIdleTime >= ROLL_IDLE_DELAY_SEC) {
        newRot = applyAutoRoll(newRot, dt);
      }
    }

    this.root.rotationQuaternion = newRot;
    this.updateVisualYawBank(dt, input);

    const fwdAfterRot = getShipForward(this.root.rotationQuaternion);
    const cap = this.maxSpeed * (input.boost ? this.boostMultiplier : 1);
    const thrustRate = 35;
    const brakeRate = 45;

    if (input.throttle > 0) {
      this.speed += input.throttle * thrustRate * dt;
    } else if (input.throttle < 0) {
      this.speed += input.throttle * brakeRate * dt;
    }

    this.speed = Scalar.Clamp(this.speed, this.minSpeed, cap);
    this.velocity.copyFrom(fwdAfterRot.scale(this.speed));
    this.root.position.addInPlace(this.velocity.scale(dt));

    if (boundary) {
      applySoftBoundary(this.root, boundary, dt);
    }

    this.forward.copyFrom(fwdAfterRot);
  }

  private updateVisualYawBank(dt: number, input: FlightInput): void {
    if (!this.visualRoot) return;

    const hasYaw = Math.abs(input.yaw) >= INPUT_DEADZONE;
    const target = hasYaw
      ? Scalar.Clamp(input.yaw, -1, 1) * YAW_VISUAL_BANK_RAD
      : 0;
    const blend = hasYaw ? 1 - Math.pow(0.00005, dt) : 1 - Math.pow(0.001, dt);
    this.visualBank = Scalar.Lerp(this.visualBank, target, blend);
    this.visualRoot.rotationQuaternion = Quaternion.RotationAxis(
      Vector3.Backward(),
      this.visualBank,
    );
  }

  getForward(): Vector3 {
    return this.forward.clone();
  }

  getSpeed(): number {
    return this.speed;
  }
}
