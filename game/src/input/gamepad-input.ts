import type { FlightInput, IInputSource } from './i-input-source';
import { ZERO_FLIGHT_INPUT } from './i-input-source';

const DEADZONE = 0.12;

/**
 * Rogue Leader (GameCube) layout via standard Gamepad API mapping.
 * Left stick: fly · R: accelerate · L: brake · Z+stick: roll · A: fire · B: secondary
 * X: cockpit · Y: (reserved) · C-stick: camera distance/orbit
 */
export class GamepadInput implements IInputSource {
  private padIndex: number | null = null;
  private cameraToggleQueued = false;
  private prevButtons: boolean[] = [];

  update(): void {
    const pads = navigator.getGamepads?.() ?? [];
    this.padIndex = null;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad?.connected) {
        this.padIndex = i;
        const pressed = pad.buttons[2]?.pressed;
        if (this.prevButtons.length > 0 && pressed && !this.prevButtons[2]) {
          this.cameraToggleQueued = true;
        }
        this.prevButtons = pad.buttons.map((b) => b.pressed);
        break;
      }
    }
  }

  getFlightInput(): FlightInput {
    if (this.padIndex === null) return { ...ZERO_FLIGHT_INPUT };

    const pad = navigator.getGamepads()?.[this.padIndex];
    if (!pad) return { ...ZERO_FLIGHT_INPUT };

    const ax = (i: number) => this.applyDeadzone(pad.axes[i] ?? 0);

    const stickX = ax(0);
    const stickY = ax(1);
    const cStickX = ax(2);
    const cStickY = ax(3);

    const btn = (i: number) => pad.buttons[i]?.pressed ?? false;
    const trigger = (i: number) => {
      const b = pad.buttons[i];
      if (!b) return 0;
      return b.value > 0.05 ? b.value : 0;
    };

    const zHeld = btn(7) || btn(8);
    const roll = zHeld ? stickX * 0.85 : 0;
    const pitch = -stickY * 0.9;
    const yaw = zHeld ? 0 : stickX * 0.75;

    let rTrigger = trigger(7);
    let lTrigger = trigger(6);
    if (rTrigger < 0.05 && btn(5)) rTrigger = 1;
    if (lTrigger < 0.05 && btn(4)) lTrigger = 1;
    const throttle = ScalarClamp(rTrigger - lTrigger, -1, 1);

    const toggle = this.cameraToggleQueued;
    this.cameraToggleQueued = false;

    return {
      throttle,
      pitch,
      yaw,
      roll,
      boost: rTrigger > 0.95,
      fire: btn(0),
      fireSecondary: btn(1),
      cameraToggle: toggle,
      cameraCycle: 0,
      cameraDistance: -cStickY,
      cameraOrbit: cStickX,
      cameraDrop: btn(13) || btn(14),
      lookAround: cStickY !== 0 || cStickX !== 0,
    };
  }

  dispose(): void {}

  private applyDeadzone(v: number): number {
    if (Math.abs(v) < DEADZONE) return 0;
    const sign = v < 0 ? -1 : 1;
    return sign * ((Math.abs(v) - DEADZONE) / (1 - DEADZONE));
  }
}

function ScalarClamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
