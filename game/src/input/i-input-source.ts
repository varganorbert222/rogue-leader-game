export interface FlightInput {
  /** W / R trigger — increase speed */
  throttle: number;
  pitch: number;
  yaw: number;
  roll: number;
  boost: boolean;
  fire: boolean;
  fireSecondary: boolean;
  /** X — toggle chase / cockpit (Rogue Leader) */
  cameraToggle: boolean;
  /** ~ / F1–F4 — cycle outside camera presets */
  cameraCycle: number;
  /** C-stick vertical / Z — adjust chase distance (-1..1) */
  cameraDistance: number;
  /** C-stick horizontal — orbit camera around ship */
  cameraOrbit: number;
  /** Z — drop camera below craft */
  cameraDrop: boolean;
  /** Tab / C-up — look around in cockpit */
  lookAround: boolean;
}

export interface IInputSource {
  update(): void;
  getFlightInput(): FlightInput;
  dispose(): void;
}

export const ZERO_FLIGHT_INPUT: FlightInput = {
  throttle: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  boost: false,
  fire: false,
  fireSecondary: false,
  cameraToggle: false,
  cameraCycle: 0,
  cameraDistance: 0,
  cameraOrbit: 0,
  cameraDrop: false,
  lookAround: false,
};

export function mergeFlightInputs(inputs: FlightInput[]): FlightInput {
  const out: FlightInput = { ...ZERO_FLIGHT_INPUT };
  for (const input of inputs) {
    if (Math.abs(input.throttle) > Math.abs(out.throttle)) out.throttle = input.throttle;
    if (Math.abs(input.pitch) > Math.abs(out.pitch)) out.pitch = input.pitch;
    if (Math.abs(input.yaw) > Math.abs(out.yaw)) out.yaw = input.yaw;
    if (Math.abs(input.roll) > Math.abs(out.roll)) out.roll = input.roll;
    if (input.boost) out.boost = true;
    if (input.fire) out.fire = true;
    if (input.fireSecondary) out.fireSecondary = true;
    if (input.cameraToggle) out.cameraToggle = true;
    out.cameraCycle += input.cameraCycle;
    if (Math.abs(input.cameraDistance) > Math.abs(out.cameraDistance)) {
      out.cameraDistance = input.cameraDistance;
    }
    if (Math.abs(input.cameraOrbit) > Math.abs(out.cameraOrbit)) {
      out.cameraOrbit = input.cameraOrbit;
    }
    if (input.cameraDrop) out.cameraDrop = true;
    if (input.lookAround) out.lookAround = true;
  }
  return out;
}
