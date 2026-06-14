import { smoothDampedScalar } from '@rogue-leader/engine';
import { FLIGHT_ANGULAR_SMOOTH_TIME } from './flight-constants';

/** Spring smooth times for body-axis angular velocity (seconds). */
export interface AngularDynamicsConfig {
  smoothTimePitch: number;
  smoothTimeYaw: number;
  smoothTimeRoll: number;
}

export const DEFAULT_ANGULAR_DYNAMICS: AngularDynamicsConfig = {
  smoothTimePitch: FLIGHT_ANGULAR_SMOOTH_TIME,
  smoothTimeYaw: FLIGHT_ANGULAR_SMOOTH_TIME,
  smoothTimeRoll: FLIGHT_ANGULAR_SMOOTH_TIME,
};

export interface AngularRates {
  pitch: number;
  yaw: number;
  roll: number;
}

/** Spring-damped angular velocity (rad/s) — shared by player and NPC flight. */
export class AngularRateSmoother {
  private pitch = 0;
  private yaw = 0;
  private roll = 0;
  private pitchVel = 0;
  private yawVel = 0;
  private rollVel = 0;

  reset(): void {
    this.pitch = 0;
    this.yaw = 0;
    this.roll = 0;
    this.pitchVel = 0;
    this.yawVel = 0;
    this.rollVel = 0;
  }

  step(
    dt: number,
    targetPitch: number,
    targetYaw: number,
    targetRoll: number,
    config: AngularDynamicsConfig = DEFAULT_ANGULAR_DYNAMICS,
  ): AngularRates {
    if (dt <= 0) {
      return { pitch: this.pitch, yaw: this.yaw, roll: this.roll };
    }

    const pitch = smoothDampedScalar(
      this.pitch,
      targetPitch,
      this.pitchVel,
      config.smoothTimePitch,
      dt,
    );
    this.pitch = pitch.value;
    this.pitchVel = pitch.velocity;

    const yaw = smoothDampedScalar(
      this.yaw,
      targetYaw,
      this.yawVel,
      config.smoothTimeYaw,
      dt,
    );
    this.yaw = yaw.value;
    this.yawVel = yaw.velocity;

    const roll = smoothDampedScalar(
      this.roll,
      targetRoll,
      this.rollVel,
      config.smoothTimeRoll,
      dt,
    );
    this.roll = roll.value;
    this.rollVel = roll.velocity;

    return { pitch: this.pitch, yaw: this.yaw, roll: this.roll };
  }
}
