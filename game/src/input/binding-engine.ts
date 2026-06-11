import type { FlightInput } from './i-input-source';
import { readGamepadTriggers } from './gamepad-profiles';
import type {
  AxisActionBindings,
  AxisCurveSettings,
  ButtonActionBindings,
  ControlBindingsConfig,
  StickSettings,
  TriggerSettings,
} from '../settings/control-bindings';

export interface BindingInputState {
  keys: ReadonlySet<string>;
  gamepad: Gamepad | null;
  pulseCounts: ReadonlyMap<string, number>;
}

export function evaluateBindings(
  config: ControlBindingsConfig,
  state: BindingInputState
): FlightInput {
  const { keys, gamepad, pulseCounts } = state;
  const gp = config.gamepad;

  const pitchAnalog = gamepad
    ? readStickAxis(gamepad, 1, gp.leftStick, gp.leftStick.invertY)
    : 0;
  const yawAnalog = gamepad
    ? readStickAxis(gamepad, 0, gp.leftStick, gp.leftStick.invertX)
    : 0;
  const throttleAnalog = gamepad ? readThrottleAxis(gamepad, gp.triggers) : 0;
  const camDistAnalog = gamepad
    ? readStickAxis(gamepad, 3, gp.rightStick, gp.rightStick.invertY)
    : 0;
  const camOrbitAnalog = gamepad
    ? readStickAxis(gamepad, 2, gp.rightStick, gp.rightStick.invertX)
    : 0;

  const pitch = mergeAxis(
    evaluateDigitalAxis(keys, gamepad, config.pitch),
    pitchAnalog,
    config.pitch.curve,
    gp.leftStick.deadzone
  );
  const yaw = mergeAxis(
    evaluateDigitalAxis(keys, gamepad, config.yaw),
    yawAnalog,
    config.yaw.curve,
    gp.leftStick.deadzone
  );
  const roll = evaluateDigitalAxis(keys, gamepad, config.roll);
  const throttle = mergeAxis(
    evaluateDigitalAxis(keys, gamepad, config.throttle),
    throttleAnalog,
    config.throttle.curve,
    gp.triggers.deadzone
  );
  const cameraDistance = mergeAxis(
    evaluateDigitalAxis(keys, gamepad, config.cameraDistance),
    camDistAnalog,
    config.cameraDistance.curve,
    gp.rightStick.deadzone
  );
  const cameraOrbit = mergeAxis(
    evaluateDigitalAxis(keys, gamepad, config.cameraOrbit),
    camOrbitAnalog,
    config.cameraOrbit.curve,
    gp.rightStick.deadzone
  );

  const fireSecondaryPressed = (pulseCounts.get('fireSecondary') ?? 0) > 0;
  const cameraCycle = pulseCounts.get('cameraCycle') ?? 0;
  const cameraProfileCycle = (pulseCounts.get('cameraProfileCycle') ?? 0) > 0;

  return {
    throttle,
    pitch: pitch * 0.85,
    yaw: yaw * 0.85,
    roll: roll * 0.65,
    boost: evaluateHeldButton(keys, gamepad, config.boost),
    fire: evaluateHeldButton(keys, gamepad, config.firePrimary),
    fireSecondaryPressed,
    cameraToggle: (pulseCounts.get('cameraToggle') ?? 0) > 0,
    cameraCycle,
    cameraProfileCycle,
    cameraDistance,
    cameraOrbit,
    cameraDrop: (pulseCounts.get('cameraDrop') ?? 0) > 0,
    lookAround:
      evaluateHeldButton(keys, gamepad, config.lookAround) ||
      (gamepad != null &&
        (Math.abs(camDistAnalog) > 0.12 || Math.abs(camOrbitAnalog) > 0.12)),
  };
}

function evaluateDigitalAxis(
  keys: ReadonlySet<string>,
  gamepad: Gamepad | null,
  action: AxisActionBindings
): number {
  let value = 0;
  if (action.keysPositive.some((code) => keys.has(code))) value += 1;
  if (action.keysNegative.some((code) => keys.has(code))) value -= 1;
  if (gamepad) {
    if (action.buttonsPositive.some((index) => gamepad.buttons[index]?.pressed)) {
      value += 1;
    }
    if (action.buttonsNegative.some((index) => gamepad.buttons[index]?.pressed)) {
      value -= 1;
    }
  }
  return Math.max(-1, Math.min(1, value));
}

function evaluateHeldButton(
  keys: ReadonlySet<string>,
  gamepad: Gamepad | null,
  action: ButtonActionBindings
): boolean {
  if (action.keys.some((code) => keys.has(code))) {
    return true;
  }
  if (!gamepad) {
    return false;
  }
  return action.buttons.some((index) => gamepad.buttons[index]?.pressed ?? false);
}

function mergeAxis(
  digital: number,
  analog: number,
  curve: AxisCurveSettings,
  stickDeadzone: number
): number {
  const analogValue = applyCurve(analog, curve);
  if (Math.abs(analogValue) > stickDeadzone * 0.5) {
    return analogValue;
  }
  return applyCurve(digital, curve);
}

function readStickAxis(
  pad: Gamepad,
  axisIndex: number,
  settings: StickSettings,
  invertAxis: boolean
): number {
  let value = pad.axes[axisIndex] ?? 0;
  if (invertAxis) {
    value = -value;
  }
  return value;
}

function readThrottleAxis(pad: Gamepad, settings: TriggerSettings): number {
  const { rTrigger, lTrigger } = readGamepadTriggers(pad);
  return rTrigger - lTrigger;
}

function applyCurve(value: number, settings: AxisCurveSettings): number {
  let v = value;
  if (settings.invert) {
    v = -v;
  }
  const dz = Math.max(0, Math.min(0.45, settings.deadzone));
  if (Math.abs(v) <= dz) {
    return 0;
  }
  const sign = Math.sign(v);
  const normalized = (Math.abs(v) - dz) / (1 - dz);
  const curved = Math.pow(normalized, Math.max(0.5, settings.exponent));
  return sign * curved * settings.sensitivity;
}
