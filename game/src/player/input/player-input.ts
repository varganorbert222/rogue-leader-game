import type { CameraInput } from './camera-input';
import type { CombatInput } from './combat-input';
import type { FlightInput } from './i-input-source';
import { mergeFlightInputs, ZERO_FLIGHT_INPUT } from './i-input-source';
import { ZERO_VEHICLE_INPUT, type VehicleInput } from './vehicle-input';

export interface PlayerInput {
  vehicle: VehicleInput;
  combat: CombatInput;
  camera: CameraInput;
}

export const ZERO_PLAYER_INPUT: PlayerInput = {
  vehicle: { ...ZERO_VEHICLE_INPUT },
  combat: { fire: false, fireSecondaryPressed: false, toggleSfoilPressed: false },
  camera: {
    cameraToggle: false,
    cameraCycle: 0,
    cameraProfileCycle: false,
    cameraDistance: 0,
    cameraOrbit: 0,
    cameraDrop: false,
    lookAround: false,
  },
};

export function playerInputFromFlightInput(input: FlightInput): PlayerInput {
  return {
    vehicle: {
      throttle: input.throttle,
      pitch: input.pitch,
      yaw: input.yaw,
      roll: input.roll,
      boost: input.boost,
    },
    combat: {
      fire: input.fire,
      fireSecondaryPressed: input.fireSecondaryPressed,
      toggleSfoilPressed: input.toggleSfoilPressed,
    },
    camera: {
      cameraToggle: input.cameraToggle,
      cameraCycle: input.cameraCycle,
      cameraProfileCycle: input.cameraProfileCycle,
      cameraDistance: input.cameraDistance,
      cameraOrbit: input.cameraOrbit,
      cameraDrop: input.cameraDrop,
      lookAround: input.lookAround,
    },
  };
}

export function flightInputFromPlayerInput(input: PlayerInput): FlightInput {
  return {
    ...ZERO_FLIGHT_INPUT,
    ...input.vehicle,
    ...input.combat,
    ...input.camera,
  };
}

export function mergePlayerInputs(inputs: PlayerInput[]): PlayerInput {
  if (inputs.length === 0) return { ...ZERO_PLAYER_INPUT };
  return playerInputFromFlightInput(
    mergeFlightInputs(inputs.map((input) => flightInputFromPlayerInput(input)))
  );
}
