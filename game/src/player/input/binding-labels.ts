import type { Binding } from '../settings/control-bindings';

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  ShiftLeft: 'L-Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'L-Ctrl',
  ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt',
  AltRight: 'R-Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '~',
  BracketLeft: '[',
  BracketRight: ']',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  NumpadEnter: 'Num Enter',
};

const GAMEPAD_BUTTON_LABELS = [
  'Cross / A',
  'Circle / B',
  'Square / X',
  'Triangle / Y',
  'L1 / LB',
  'R1 / RB',
  'L2 / LT',
  'R2 / RT',
  'Share / View',
  'Options / Menu',
  'L3',
  'R3',
  'D-Up',
  'D-Down',
  'D-Left',
  'D-Right',
];

export function formatKeyboardCode(code: string): string {
  if (KEY_LABELS[code]) {
    return KEY_LABELS[code];
  }
  if (code.startsWith('Key')) {
    return code.slice(3);
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    return code.replace('Numpad', 'Num ');
  }
  if (code.startsWith('F') && /^F\d+$/.test(code)) {
    return code;
  }
  return code;
}

export function formatGamepadButton(index: number): string {
  return GAMEPAD_BUTTON_LABELS[index] ?? `Btn ${index}`;
}

export function formatGamepadAxis(axis: number, sign: 1 | -1): string {
  const axisNames = ['LX', 'LY', 'RX', 'RY', 'L2 axis', 'R2 axis'];
  const name = axisNames[axis] ?? `Axis ${axis}`;
  return sign < 0 ? `${name} −` : `${name} +`;
}

export function formatBinding(binding: Binding): string {
  switch (binding.type) {
    case 'keyboard':
      return formatKeyboardCode(binding.code);
    case 'gamepadButton':
      return formatGamepadButton(binding.index);
    case 'gamepadAxis':
      return formatGamepadAxis(binding.axis, binding.sign);
    default:
      return '?';
  }
}

export function formatBindingList(bindings: Binding[]): string {
  if (bindings.length === 0) {
    return '—';
  }
  return bindings.map(formatBinding).join(', ');
}
