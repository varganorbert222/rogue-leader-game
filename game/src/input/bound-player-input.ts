import {
  gamepadIdsMatch,
  isUsableGamepad,
  pickPreferredGamepadSlot,
} from './gamepad-profiles';
import { evaluateBindings } from './binding-engine';
import type { FlightInput } from './i-input-source';
import type { IPlayerInputSource } from './i-player-input-source';
import { playerInputFromFlightInput, type PlayerInput } from './player-input';
import {
  loadControlBindings,
  type ButtonActionBindings,
  type ControlBindingsConfig,
} from '../settings/control-bindings';

/** Config-driven player input — keyboard, mouse, and gamepad via binding tables. */
export class BoundPlayerInput implements IPlayerInputSource {
  private config: ControlBindingsConfig;
  private readonly keys = new Set<string>();
  private readonly pulseCounts = new Map<string, number>();
  private readonly prevGamepadButtons = new Map<string, boolean[]>();
  private padIndex: number | null = null;

  constructor(config?: ControlBindingsConfig) {
    this.config = config ?? loadControlBindings();
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.queuePulseOnKeydown(event.code);
    };
    const up = (event: KeyboardEvent) => this.keys.delete(event.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.disposeFn = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }

  private disposeFn: () => void = () => {};

  setConfig(config: ControlBindingsConfig): void {
    this.config = config;
    this.padIndex = null;
  }

  getConfig(): ControlBindingsConfig {
    return this.config;
  }

  update(): void {
    this.refreshPadIndex();
    this.trackGamepadPulses();
  }

  getPlayerInput(): PlayerInput {
    return playerInputFromFlightInput(this.getFlightInput());
  }

  getFlightInput(): FlightInput {
    const input = evaluateBindings(this.config, {
      keys: this.keys,
      gamepad: this.getActivePad(),
      pulseCounts: this.pulseCounts,
    });

    this.pulseCounts.clear();
    return input;
  }

  dispose(): void {
    this.disposeFn();
  }

  private queuePulseOnKeydown(code: string): void {
    this.queuePulseForAction('fireSecondary', this.config.fireSecondary, code);
    this.queuePulseForAction('cameraToggle', this.config.cameraToggle, code);
    this.queuePulseForAction('cameraCycle', this.config.cameraCycle, code);
    this.queuePulseForAction('cameraDrop', this.config.cameraDrop, code);
  }

  private queuePulseForAction(
    id: string,
    action: ButtonActionBindings,
    code: string
  ): void {
    if (!action.pulse || !action.keys.includes(code)) {
      return;
    }
    this.pulseCounts.set(id, (this.pulseCounts.get(id) ?? 0) + 1);
  }

  private trackGamepadPulses(): void {
    const pad = this.getActivePad();
    if (!pad) {
      return;
    }

    const prev = this.prevGamepadButtons.get(pad.id) ?? [];
    const track = (id: string, action: ButtonActionBindings): void => {
      if (!action.pulse) return;
      for (const index of action.buttons) {
        const pressed = pad.buttons[index]?.pressed ?? false;
        const wasPressed = prev[index] ?? false;
        if (pressed && !wasPressed) {
          this.pulseCounts.set(id, (this.pulseCounts.get(id) ?? 0) + 1);
        }
      }
    };

    track('fireSecondary', this.config.fireSecondary);
    track('cameraToggle', this.config.cameraToggle);
    track('cameraCycle', this.config.cameraCycle);
    track('cameraDrop', this.config.cameraDrop);

    this.prevGamepadButtons.set(
      pad.id,
      pad.buttons.map((button) => button.pressed)
    );
  }

  private getActivePad(): Gamepad | null {
    if (this.padIndex === null) {
      return null;
    }
    return navigator.getGamepads?.()?.[this.padIndex] ?? null;
  }

  private refreshPadIndex(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const preferred = this.config.gamepad.selectedGamepadId;
    if (preferred) {
      this.padIndex = pickPreferredGamepadSlot(pads, (pad) =>
        gamepadIdsMatch(preferred, pad.id)
      );
      return;
    }
    this.padIndex = pickPreferredGamepadSlot(pads, (pad) => isUsableGamepad(pad));
  }
}
