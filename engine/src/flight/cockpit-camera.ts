import { Quaternion, Scalar, Vector3 } from '@babylonjs/core';
import { degToRad, smoothDampedScalar } from '../math';
import type { CockpitInputResponseConfig, ResolvedCockpitConfig } from '../loaders/cockpit-config';
import { getShipForward, getShipRight, getShipUp } from './ship-forward-babylon';

/** Normalized flight stick — matches game {@link VehicleInput} axes. */
export interface CockpitVehicleInput {
  throttle: number;
  pitch: number;
  yaw: number;
  roll: number;
}

export const ZERO_COCKPIT_VEHICLE_INPUT: CockpitVehicleInput = {
  throttle: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
};

export interface CockpitInputOffsetState {
  localOffset: Vector3;
  smoothedInput: CockpitVehicleInput;
  smoothedInputVel: CockpitVehicleInput;
}

export function createCockpitInputOffsetState(): CockpitInputOffsetState {
  return {
    localOffset: Vector3.Zero(),
    smoothedInput: { ...ZERO_COCKPIT_VEHICLE_INPUT },
    smoothedInputVel: { ...ZERO_COCKPIT_VEHICLE_INPUT },
  };
}

export function resetCockpitInputOffsetState(state: CockpitInputOffsetState): void {
  state.localOffset.setAll(0);
  Object.assign(state.smoothedInput, ZERO_COCKPIT_VEHICLE_INPUT);
  Object.assign(state.smoothedInputVel, ZERO_COCKPIT_VEHICLE_INPUT);
}

function clampStick(value: number): number {
  return Scalar.Clamp(value, -1, 1);
}

function smoothStickAxis(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): { value: number; velocity: number } {
  return smoothDampedScalar(current, clampStick(target), velocity, smoothTime, dt);
}

/** Target ship-local offset from stick input. */
export function cockpitInputTargetOffset(
  input: CockpitVehicleInput,
  config: CockpitInputResponseConfig,
): Vector3 {
  const [rightMax, upMax, backMax] = config.maxInputOffset;
  return new Vector3(
    clampStick(input.yaw) * rightMax,
    clampStick(input.pitch) * upMax,
    -clampStick(input.throttle) * backMax,
  );
}

export function updateCockpitInputOffsetState(
  state: CockpitInputOffsetState,
  dt: number,
  config: CockpitInputResponseConfig,
  input: CockpitVehicleInput,
): void {
  if (dt <= 0) return;

  const smoothTime = config.smoothTime;
  const smoothed = state.smoothedInput;
  const smoothedVel = state.smoothedInputVel;

  const pitch = smoothStickAxis(smoothed.pitch, input.pitch, smoothedVel.pitch, smoothTime, dt);
  smoothed.pitch = pitch.value;
  smoothedVel.pitch = pitch.velocity;

  const yaw = smoothStickAxis(smoothed.yaw, input.yaw, smoothedVel.yaw, smoothTime, dt);
  smoothed.yaw = yaw.value;
  smoothedVel.yaw = yaw.velocity;

  const throttle = smoothStickAxis(
    smoothed.throttle,
    input.throttle,
    smoothedVel.throttle,
    smoothTime,
    dt,
  );
  smoothed.throttle = throttle.value;
  smoothedVel.throttle = throttle.velocity;

  const roll = smoothStickAxis(smoothed.roll, input.roll, smoothedVel.roll, smoothTime, dt);
  smoothed.roll = roll.value;
  smoothedVel.roll = roll.velocity;

  state.localOffset.copyFrom(cockpitInputTargetOffset(smoothed, config));
}

export function composeShipVisualRotation(
  shipRot: Quaternion,
  visualBank = 0,
  invertForwardRoll = false,
): Quaternion {
  if (Math.abs(visualBank) < 1e-8) return shipRot.clone();
  const rollAngle = invertForwardRoll ? -visualBank : visualBank;
  return shipRot
    .multiply(Quaternion.RotationAxis(Vector3.Forward(), -rollAngle))
    .normalize();
}

export function computeCockpitPose(
  shipPos: Vector3,
  shipRot: Quaternion,
  config: ResolvedCockpitConfig,
  lookAroundYaw: number,
  lookAroundPitch: number,
  inputOffset: CockpitInputOffsetState,
  visualRot?: Quaternion,
): { position: Vector3; orientation: Quaternion } {
  const basisRot = visualRot ?? shipRot;
  const right = getShipRight(basisRot);
  const up = getShipUp(basisRot);
  const fwd = getShipForward(basisRot);
  const [ox, oy, oz] = config.localOffset;
  const [ix, iy, iz] = [
    inputOffset.localOffset.x,
    inputOffset.localOffset.y,
    inputOffset.localOffset.z,
  ];

  const position = shipPos
    .add(right.scale(ox + ix))
    .add(up.scale(oy + iy))
    .add(fwd.scale(oz + iz));

  let orientation = basisRot.clone();
  const [pitchDeg, yawDeg, rollDeg] = config.localRotationDeg;
  if (pitchDeg !== 0 || yawDeg !== 0 || rollDeg !== 0) {
    orientation = orientation
      .multiply(
        Quaternion.RotationYawPitchRoll(
          degToRad(yawDeg),
          degToRad(pitchDeg),
          degToRad(rollDeg),
        ),
      )
      .normalize();
  }

  const baseUp = getShipUp(orientation);
  const baseRight = getShipRight(orientation);
  const lookYaw = Quaternion.RotationAxis(baseUp, lookAroundYaw);
  const lookPitch = Quaternion.RotationAxis(baseRight, lookAroundPitch);
  orientation = lookPitch.multiply(lookYaw).multiply(orientation).normalize();

  return { position, orientation };
}
