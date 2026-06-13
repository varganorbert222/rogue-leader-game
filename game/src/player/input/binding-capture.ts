import type { Binding } from '../settings/control-bindings';
import { isUsableGamepad } from './gamepad-profiles';

const IGNORE_KEYS = new Set([
  'Escape',
  'Tab',
  'MetaLeft',
  'MetaRight',
]);

export interface BindingCaptureOptions {
  allowKeyboard?: boolean;
  allowGamepad?: boolean;
  allowMouse?: boolean;
}

export interface BindingCaptureSession {
  cancel(): void;
}

/**
 * Listen for the next keyboard key, gamepad button, or significant axis deflection.
 * Returns a dispose function that cancels capture.
 */
export function startBindingCapture(
  onCapture: (binding: Binding) => void,
  onCancel?: () => void,
  options: BindingCaptureOptions = {}
): BindingCaptureSession {
  const allowKeyboard = options.allowKeyboard ?? true;
  const allowGamepad = options.allowGamepad ?? true;
  const allowMouse = options.allowMouse ?? false;

  let disposed = false;
  const baselineAxes = new Map<string, number[]>();

  const snapshotAxes = (): void => {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || !isUsableGamepad(pad)) continue;
      baselineAxes.set(pad.id, [...pad.axes]);
    }
  };

  snapshotAxes();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!allowKeyboard || disposed) return;
    event.preventDefault();
    event.stopPropagation();
    if (IGNORE_KEYS.has(event.code)) {
      onCancel?.();
      cleanup();
      return;
    }
    onCapture({ type: 'keyboard', code: event.code });
    cleanup();
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (!allowMouse || disposed) return;
    event.preventDefault();
    event.stopPropagation();
    const code = mouseButtonCode(event.button);
    if (!code) {
      onCancel?.();
      cleanup();
      return;
    }
    onCapture({ type: 'keyboard', code });
    cleanup();
  };

  const poll = (): void => {
    if (disposed || !allowGamepad) return;
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || !isUsableGamepad(pad)) continue;

      for (let i = 0; i < pad.buttons.length; i++) {
        const pressed = pad.buttons[i]?.pressed ?? false;
        if (pressed) {
          onCapture({ type: 'gamepadButton', index: i });
          cleanup();
          return;
        }
      }

      const base = baselineAxes.get(pad.id) ?? [];
      for (let axis = 0; axis < pad.axes.length; axis++) {
        const current = pad.axes[axis] ?? 0;
        const start = base[axis] ?? 0;
        const delta = current - start;
        if (Math.abs(delta) > 0.55) {
          onCapture({
            type: 'gamepadAxis',
            axis,
            sign: delta > 0 ? 1 : -1,
          });
          cleanup();
          return;
        }
        if (Math.abs(current) > 0.65 && Math.abs(start) < 0.2) {
          onCapture({
            type: 'gamepadAxis',
            axis,
            sign: current > 0 ? 1 : -1,
          });
          cleanup();
          return;
        }
      }
    }
  };

  const interval = window.setInterval(poll, 40);
  window.addEventListener('keydown', onKeyDown, true);
  if (allowMouse) {
    window.addEventListener('mousedown', onMouseDown, true);
  }

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(interval);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('mousedown', onMouseDown, true);
  };

  return {
    cancel: () => {
      onCancel?.();
      cleanup();
    },
  };
}

function mouseButtonCode(button: number): string | null {
  switch (button) {
    case 0:
      return 'MouseLeft';
    case 1:
      return 'MouseMiddle';
    case 2:
      return 'MouseRight';
    case 3:
      return 'MouseBack';
    case 4:
      return 'MouseForward';
    default:
      return null;
  }
}
