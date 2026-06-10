/** Sony USB vendor id in Gamepad.id strings (054c). */
const SONY_VENDOR = '054c';

export function normalizeGamepadIdKey(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Match saved vs connected ids (USB vs Bluetooth DualSense strings differ). */
export function gamepadIdsMatch(savedId: string, connectedId: string): boolean {
  if (savedId === connectedId) return true;

  const saved = normalizeGamepadIdKey(savedId);
  const connected = normalizeGamepadIdKey(connectedId);
  if (!saved || !connected) return false;
  if (saved === connected) return true;

  if (saved.includes('dualsense') && connected.includes('dualsense')) {
    return true;
  }

  if (saved.includes('dualshock') && connected.includes('dualshock')) {
    return true;
  }

  const savedSony =
    saved.includes(SONY_VENDOR) ||
    saved.includes('sony') ||
    saved.includes('wirelesscontroller') ||
    saved.includes('playstation');
  const connectedSony =
    connected.includes(SONY_VENDOR) ||
    connected.includes('sony') ||
    connected.includes('wirelesscontroller') ||
    connected.includes('playstation');

  if (savedSony && connectedSony) {
    return true;
  }

  return false;
}

export function isPlayStationGamepad(pad: Gamepad): boolean {
  const id = pad.id.toLowerCase();
  return (
    id.includes('dualsense') ||
    id.includes('dualshock') ||
    id.includes('playstation') ||
    id.includes(SONY_VENDOR) ||
    id.includes('wireless controller')
  );
}

export function isXboxGamepad(pad: Gamepad): boolean {
  const id = pad.id.toLowerCase();
  return (
    id.includes('xbox') ||
    id.includes('xinput') ||
    id.includes('045e-') ||
    id.includes('microsoft')
  );
}

/** Chrome/Edge often leave mapping empty for DualSense; layout is still standard. */
export function usesStandardGamepadLayout(pad: Gamepad): boolean {
  if (pad.mapping === 'standard') return true;
  return isPlayStationGamepad(pad) || isXboxGamepad(pad);
}

export function isUsableGamepad(pad: Gamepad): boolean {
  return pad.connected && pad.buttons.length > 0 && pad.axes.length >= 2;
}

/** Non-zero sticks/buttons — used to pick the live slot when Chrome lists duplicates. */
export function gamepadActivityScore(pad: Gamepad): number {
  let score = 0;
  for (const button of pad.buttons) {
    if (button.pressed) score += 10;
    score += button.value;
  }
  for (const axis of pad.axes) {
    score += Math.abs(axis);
  }
  return score;
}

/**
 * Chrome/Edge often expose one physical pad in multiple slots with the same id.
 * Prefer the slot with input activity; when idle, prefer the higher index (live slot).
 */
export function pickPreferredGamepadSlot(
  pads: (Gamepad | null)[],
  matches: (pad: Gamepad) => boolean
): number | null {
  let bestIndex: number | null = null;
  let bestRank = -1;

  for (let index = 0; index < pads.length; index++) {
    const pad = pads[index];
    if (!pad || !isUsableGamepad(pad) || !matches(pad)) continue;

    const rank = gamepadActivityScore(pad) * 1000 + index;
    if (rank > bestRank) {
      bestRank = rank;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function formatGamepadLabel(pad: Gamepad): string {
  if (isPlayStationGamepad(pad)) {
    if (pad.id.toLowerCase().includes('dualsense')) {
      return 'PlayStation DualSense';
    }
    if (pad.id.toLowerCase().includes('dualshock')) {
      return 'PlayStation DualShock';
    }
    return 'PlayStation Controller';
  }

  const trimmed = pad.id.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return `Controller ${pad.index + 1}`;
}

export interface GamepadTriggerValues {
  rTrigger: number;
  lTrigger: number;
}

export function readGamepadTriggers(pad: Gamepad): GamepadTriggerValues {
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  const trigger = (i: number) => {
    const b = pad.buttons[i];
    if (!b) return 0;
    return b.value > 0.05 ? b.value : 0;
  };

  if (usesStandardGamepadLayout(pad)) {
    let rTrigger = trigger(7);
    let lTrigger = trigger(6);
    if (rTrigger < 0.05 && btn(5)) rTrigger = 1;
    if (lTrigger < 0.05 && btn(4)) lTrigger = 1;
    return { rTrigger, lTrigger };
  }

  // Firefox / legacy PS: L2/R2 often on axes 4/5 (0..1 or -1..1).
  if (isPlayStationGamepad(pad) && pad.axes.length >= 6) {
    const axisValue = (v: number) => {
      if (v >= 0 && v <= 1) return v;
      return ScalarClamp((v + 1) * 0.5, 0, 1);
    };
    let rTrigger = axisValue(pad.axes[5] ?? 0);
    let lTrigger = axisValue(pad.axes[4] ?? 0);
    if (rTrigger < 0.05 && btn(5)) rTrigger = 1;
    if (lTrigger < 0.05 && btn(4)) lTrigger = 1;
    return { rTrigger, lTrigger };
  }

  let rTrigger = trigger(7);
  let lTrigger = trigger(6);
  if (rTrigger < 0.05 && btn(5)) rTrigger = 1;
  if (lTrigger < 0.05 && btn(4)) lTrigger = 1;
  return { rTrigger, lTrigger };
}

export function isRollModifierHeld(pad: Gamepad): boolean {
  const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
  const trigger = (i: number) => pad.buttons[i]?.value ?? 0;

  if (usesStandardGamepadLayout(pad) || isPlayStationGamepad(pad)) {
    return btn(4) || trigger(6) > 0.5;
  }

  return btn(7) || btn(8);
}

/** PS Share/Create or Xbox Select — avoid Square (2) for camera toggle. */
export function isCameraTogglePressed(pad: Gamepad, buttonIndex: number): boolean {
  if (usesStandardGamepadLayout(pad) || isPlayStationGamepad(pad)) {
    return buttonIndex === 8 || buttonIndex === 9;
  }
  return buttonIndex === 2;
}

function ScalarClamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
