import { INPUT_DEADZONE } from './flight-assist';
import { approachScalar, expDecayFactor } from '@rogue-leader/engine';

/** First-order angular rate model — shared by player and NPC flight. */
export interface AngularDynamicsConfig {
  /** Approach speed toward commanded rate (1/s). Higher = snappier. */
  responsePitch: number;
  responseYaw: number;
  responseRoll: number;
  /** Passive decay when command is near zero (1/s). */
  damping: number;
}

export const DEFAULT_ANGULAR_DYNAMICS: AngularDynamicsConfig = {
  responsePitch: 9,
  responseYaw: 8.5,
  responseRoll: 10,
  damping: 3.5,
};

export interface AngularRates {
  pitch: number;
  yaw: number;
  roll: number;
}

/** Exponential smoothing on body-axis angular velocity (rad/s). */
export class AngularRateSmoother {
  private pitch = 0;
  private yaw = 0;
  private roll = 0;

  reset(): void {
    this.pitch = 0;
    this.yaw = 0;
    this.roll = 0;
  }

  /**
   * Move current angular velocity toward commanded rates with axis-specific response,
   * then apply light damping when a command is released.
   */
  step(
    dt: number,
    targetPitch: number,
    targetYaw: number,
    targetRoll: number,
    config: AngularDynamicsConfig = DEFAULT_ANGULAR_DYNAMICS
  ): AngularRates {
    if (dt <= 0) {
      return { pitch: this.pitch, yaw: this.yaw, roll: this.roll };
    }

    this.pitch = approach(this.pitch, targetPitch, config.responsePitch, dt);
    this.yaw = approach(this.yaw, targetYaw, config.responseYaw, dt);
    this.roll = approach(this.roll, targetRoll, config.responseRoll, dt);

    const damp = expDecayFactor(config.damping, dt);
    if (Math.abs(targetPitch) < INPUT_DEADZONE) {
      this.pitch *= damp;
    }
    if (Math.abs(targetYaw) < INPUT_DEADZONE) {
      this.yaw *= damp;
    }
    if (Math.abs(targetRoll) < INPUT_DEADZONE) {
      this.roll *= damp;
    }

    return { pitch: this.pitch, yaw: this.yaw, roll: this.roll };
  }
}

function approach(current: number, target: number, response: number, dt: number): number {
  return approachScalar(current, target, response, dt);
}
