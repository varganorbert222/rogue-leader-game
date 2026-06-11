/** Flight axes shared by player and NPC control paths. */
export interface VehicleInput {
  throttle: number;
  pitch: number;
  yaw: number;
  roll: number;
  boost: boolean;
}

export const ZERO_VEHICLE_INPUT: VehicleInput = {
  throttle: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  boost: false,
};
