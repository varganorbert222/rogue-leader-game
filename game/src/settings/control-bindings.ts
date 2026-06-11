import { normalizeSelectedGamepadId } from "./flight-preferences";

export const CONTROL_BINDINGS_STORAGE_KEY = "rogue-leader-controls";

export type ControlActionId =
  | "pitch"
  | "yaw"
  | "roll"
  | "throttle"
  | "boost"
  | "firePrimary"
  | "fireSecondary"
  | "cameraToggle"
  | "cameraCycle"
  | "cameraDrop"
  | "lookAround"
  | "cameraDistance"
  | "cameraOrbit";

export type Binding =
  | { type: "keyboard"; code: string }
  | { type: "gamepadButton"; index: number }
  | { type: "gamepadAxis"; axis: number; sign: 1 | -1 };

export interface AxisCurveSettings {
  deadzone: number;
  sensitivity: number;
  exponent: number;
  invert: boolean;
}

export interface StickSettings extends AxisCurveSettings {
  invertX: boolean;
  invertY: boolean;
}

export interface TriggerSettings {
  deadzone: number;
  sensitivity: number;
  exponent: number;
}

export interface AxisActionBindings {
  keysPositive: string[];
  keysNegative: string[];
  buttonsPositive: number[];
  buttonsNegative: number[];
  curve: AxisCurveSettings;
}

export interface ButtonActionBindings {
  keys: string[];
  buttons: number[];
  /** Fire once per physical press (secondary weapons, camera toggles). */
  pulse?: boolean;
}

export interface ControlBindingsConfig {
  version: 1;
  pitch: AxisActionBindings;
  yaw: AxisActionBindings;
  roll: AxisActionBindings;
  throttle: AxisActionBindings;
  cameraDistance: AxisActionBindings;
  cameraOrbit: AxisActionBindings;
  boost: ButtonActionBindings;
  firePrimary: ButtonActionBindings;
  fireSecondary: ButtonActionBindings;
  cameraToggle: ButtonActionBindings;
  cameraCycle: ButtonActionBindings;
  cameraDrop: ButtonActionBindings;
  lookAround: ButtonActionBindings;
  gamepad: {
    selectedGamepadId: string | null;
    leftStick: StickSettings;
    rightStick: StickSettings;
    triggers: TriggerSettings;
  };
}

const DEFAULT_AXIS_CURVE: AxisCurveSettings = {
  deadzone: 0.12,
  sensitivity: 1,
  exponent: 1.75,
  invert: false,
};

const DEFAULT_STICK: StickSettings = {
  deadzone: 0.12,
  sensitivity: 1,
  exponent: 1.75,
  invert: false,
  invertX: false,
  invertY: false,
};

export const DEFAULT_CONTROL_BINDINGS: ControlBindingsConfig = {
  version: 1,
  pitch: {
    keysPositive: ["ArrowDown", "KeyK", "Numpad2"],
    keysNegative: ["ArrowUp", "KeyI", "Numpad8"],
    buttonsPositive: [],
    buttonsNegative: [],
    curve: { ...DEFAULT_AXIS_CURVE },
  },
  yaw: {
    keysPositive: ["ArrowRight", "KeyL", "Numpad6"],
    keysNegative: ["ArrowLeft", "KeyJ", "Numpad4"],
    buttonsPositive: [],
    buttonsNegative: [],
    curve: { ...DEFAULT_AXIS_CURVE },
  },
  roll: {
    keysPositive: ["KeyE"],
    keysNegative: ["KeyQ"],
    // L1 / R1 shoulders (standard indices 4 / 5) — not L2/R2 triggers.
    buttonsPositive: [5],
    buttonsNegative: [4],
    curve: { ...DEFAULT_AXIS_CURVE, sensitivity: 0.85 },
  },
  throttle: {
    keysPositive: ["KeyW"],
    keysNegative: ["KeyS"],
    // Analog L2/R2 only (readGamepadTriggers) — no digital trigger buttons here.
    buttonsPositive: [],
    buttonsNegative: [],
    curve: { ...DEFAULT_AXIS_CURVE },
  },
  cameraDistance: {
    keysPositive: ["PageDown"],
    keysNegative: ["PageUp"],
    buttonsPositive: [],
    buttonsNegative: [],
    curve: { ...DEFAULT_AXIS_CURVE, sensitivity: 0.9 },
  },
  cameraOrbit: {
    keysPositive: ["BracketRight"],
    keysNegative: ["BracketLeft"],
    buttonsPositive: [],
    buttonsNegative: [],
    curve: { ...DEFAULT_AXIS_CURVE, sensitivity: 0.9 },
  },
  boost: {
    keys: ["ShiftLeft", "ShiftRight"],
    buttons: [],
  },
  firePrimary: {
    keys: ["Space", "Digit0", "ControlLeft", "ControlRight"],
    buttons: [0],
  },
  fireSecondary: {
    keys: ["AltLeft", "AltRight", "Enter", "NumpadEnter"],
    buttons: [3],
    pulse: true,
  },
  cameraToggle: {
    keys: ["F8"],
    buttons: [8, 9],
    pulse: true,
  },
  cameraCycle: {
    keys: ["Backquote", "F1", "F2", "F3", "F4", "F5"],
    buttons: [],
    pulse: true,
  },
  cameraDrop: {
    keys: ["KeyZ"],
    buttons: [13, 14],
    pulse: true,
  },
  lookAround: {
    keys: ["Tab"],
    buttons: [],
  },
  gamepad: {
    selectedGamepadId: null,
    leftStick: { ...DEFAULT_STICK },
    rightStick: { ...DEFAULT_STICK, deadzone: 0.14 },
    triggers: { deadzone: 0.08, sensitivity: 1, exponent: 1.5 },
  },
};

export const CONTROL_ACTION_LABELS: Record<
  ControlActionId,
  { en: string; hu: string }
> = {
  pitch: { en: "Pitch", hu: "Bólintás" },
  yaw: { en: "Yaw", hu: "Fordulás" },
  roll: { en: "Roll", hu: "Roll" },
  throttle: { en: "Throttle / brake", hu: "Gáz / fék" },
  boost: { en: "Boost", hu: "Gyorsítás" },
  firePrimary: { en: "Fire blasters", hu: "Lövés (elsődleges)" },
  fireSecondary: { en: "Secondary weapon", hu: "Másodlagos fegyver" },
  cameraToggle: { en: "Cockpit camera", hu: "Kabin kamera" },
  cameraCycle: { en: "Cycle camera", hu: "Kamera váltás" },
  cameraDrop: { en: "Drop camera", hu: "Kamera le" },
  lookAround: { en: "Look around", hu: "Körülnézés" },
  cameraDistance: { en: "Camera distance", hu: "Kamera távolság" },
  cameraOrbit: { en: "Camera orbit", hu: "Kamera körbeforgatás" },
};

export const AXIS_ACTION_IDS: ControlActionId[] = [
  "pitch",
  "yaw",
  "roll",
  "throttle",
  "cameraDistance",
  "cameraOrbit",
];

export const BUTTON_ACTION_IDS: ControlActionId[] = [
  "boost",
  "firePrimary",
  "fireSecondary",
  "cameraToggle",
  "cameraCycle",
  "cameraDrop",
  "lookAround",
];

function mergeAxisAction(
  base: AxisActionBindings,
  patch?: Partial<AxisActionBindings>,
): AxisActionBindings {
  if (!patch) return { ...base, curve: { ...base.curve } };
  return {
    keysPositive: patch.keysPositive ?? base.keysPositive,
    keysNegative: patch.keysNegative ?? base.keysNegative,
    buttonsPositive: patch.buttonsPositive ?? base.buttonsPositive,
    buttonsNegative: patch.buttonsNegative ?? base.buttonsNegative,
    curve: { ...base.curve, ...patch.curve },
  };
}

function mergeButtonAction(
  base: ButtonActionBindings,
  patch?: Partial<ButtonActionBindings>,
): ButtonActionBindings {
  if (!patch) return { ...base };
  return {
    keys: patch.keys ?? base.keys,
    buttons: patch.buttons ?? base.buttons,
    pulse: patch.pulse ?? base.pulse,
  };
}

/** Fix pre-DualSense roll/throttle maps that collided L2/R2 with shoulders. */
function repairLegacyGamepadAxisBindings(
  config: ControlBindingsConfig,
): ControlBindingsConfig {
  const roll = { ...config.roll, curve: { ...config.roll.curve } };
  if (roll.buttonsNegative.includes(6)) {
    const withoutL2 = roll.buttonsNegative.filter((index) => index !== 6);
    roll.buttonsNegative = withoutL2.includes(4) ? withoutL2 : [...withoutL2, 4];
  }

  const throttle = { ...config.throttle, curve: { ...config.throttle.curve } };
  const triggerButtonIndices = new Set([6, 7, 8]);
  if (
    throttle.buttonsPositive.some((index) => triggerButtonIndices.has(index)) ||
    throttle.buttonsNegative.some((index) => triggerButtonIndices.has(index))
  ) {
    throttle.buttonsPositive = throttle.buttonsPositive.filter(
      (index) => !triggerButtonIndices.has(index),
    );
    throttle.buttonsNegative = throttle.buttonsNegative.filter(
      (index) => !triggerButtonIndices.has(index),
    );
  }

  return { ...config, roll, throttle };
}

export function cloneControlBindings(
  config: ControlBindingsConfig,
): ControlBindingsConfig {
  return JSON.parse(JSON.stringify(config)) as ControlBindingsConfig;
}

export function loadControlBindings(): ControlBindingsConfig {
  if (typeof localStorage === "undefined") {
    return cloneControlBindings(DEFAULT_CONTROL_BINDINGS);
  }

  try {
    const raw = localStorage.getItem(CONTROL_BINDINGS_STORAGE_KEY);
    if (!raw) {
      return cloneControlBindings(DEFAULT_CONTROL_BINDINGS);
    }
    const parsed = JSON.parse(raw) as Partial<ControlBindingsConfig>;
    return repairLegacyGamepadAxisBindings(
      mergeControlBindings(DEFAULT_CONTROL_BINDINGS, parsed),
    );
  } catch {
    return cloneControlBindings(DEFAULT_CONTROL_BINDINGS);
  }
}

export function mergeControlBindings(
  defaults: ControlBindingsConfig,
  patch: Partial<ControlBindingsConfig>,
): ControlBindingsConfig {
  return repairLegacyGamepadAxisBindings({
    version: 1,
    pitch: mergeAxisAction(defaults.pitch, patch.pitch),
    yaw: mergeAxisAction(defaults.yaw, patch.yaw),
    roll: mergeAxisAction(defaults.roll, patch.roll),
    throttle: mergeAxisAction(defaults.throttle, patch.throttle),
    cameraDistance: mergeAxisAction(
      defaults.cameraDistance,
      patch.cameraDistance,
    ),
    cameraOrbit: mergeAxisAction(defaults.cameraOrbit, patch.cameraOrbit),
    boost: mergeButtonAction(defaults.boost, patch.boost),
    firePrimary: mergeButtonAction(defaults.firePrimary, patch.firePrimary),
    fireSecondary: mergeButtonAction(
      defaults.fireSecondary,
      patch.fireSecondary,
    ),
    cameraToggle: mergeButtonAction(defaults.cameraToggle, patch.cameraToggle),
    cameraCycle: mergeButtonAction(defaults.cameraCycle, patch.cameraCycle),
    cameraDrop: mergeButtonAction(defaults.cameraDrop, patch.cameraDrop),
    lookAround: mergeButtonAction(defaults.lookAround, patch.lookAround),
    gamepad: {
      selectedGamepadId: normalizeSelectedGamepadId(
        patch.gamepad?.selectedGamepadId ?? defaults.gamepad.selectedGamepadId,
      ),
      leftStick: { ...defaults.gamepad.leftStick, ...patch.gamepad?.leftStick },
      rightStick: {
        ...defaults.gamepad.rightStick,
        ...patch.gamepad?.rightStick,
      },
      triggers: { ...defaults.gamepad.triggers, ...patch.gamepad?.triggers },
    },
  });
}

export function saveControlBindings(
  config: ControlBindingsConfig,
): ControlBindingsConfig {
  const next = mergeControlBindings(DEFAULT_CONTROL_BINDINGS, config);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CONTROL_BINDINGS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function resetControlBindings(): ControlBindingsConfig {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CONTROL_BINDINGS_STORAGE_KEY);
  }
  return cloneControlBindings(DEFAULT_CONTROL_BINDINGS);
}
