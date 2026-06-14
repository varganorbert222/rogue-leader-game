import { clamp } from '@rogue-leader/engine';
import {
  gamepadIdsMatch,
  isCameraTogglePressed,
  isPlayStationGamepad,
  isRollModifierHeld,
  isUsableGamepad,
  pickPreferredGamepadSlot,
  readGamepadTriggers,
} from './gamepad-profiles';
import {
  loadFlightPreferences,
  normalizeSelectedGamepadId,
  saveFlightPreferences,
} from '../settings/flight-preferences';
import type { FlightInput, IInputSource } from './i-input-source';
import { ZERO_FLIGHT_INPUT } from './i-input-source';
import type { IPlayerInputSource } from './i-player-input-source';
import { playerInputFromFlightInput, type PlayerInput } from './player-input';
import { applyRadialDeadzone } from './analog-curve';

const DEADZONE = 0.12;

/**
 * Standard / PlayStation / Xbox layout via Gamepad API.
 * Left stick: fly · R2: accelerate · L2: brake · L1+stick: roll · Cross/A: fire
 * Right stick: camera · Options/Share: cockpit toggle
 */
export class GamepadInput implements IPlayerInputSource {
  private padIndex: number | null = null;
  private preferredGamepadId: string | null = normalizeSelectedGamepadId(
    loadFlightPreferences().selectedGamepadId
  );
  private cameraToggleQueued = false;
  private fireSecondaryQueued = false;
  private prevButtons: boolean[] = [];
  private activationListenerAttached = false;

  private readonly onGamepadEvent = (event: Event): void => {
    if (event instanceof GamepadEvent && event.type === 'gamepadconnected') {
      this.pinPadIfEligible(event.gamepad);
    }
    this.refreshPadIndex();
  };

  private readonly onUserActivate = (): void => {
    this.refreshPadIndex();
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadEvent);
      window.addEventListener('gamepaddisconnected', this.onGamepadEvent);
      this.attachActivationListeners();
    }
  }

  setPreferredGamepadId(gamepadId: string | null, persist = true): void {
    this.preferredGamepadId = normalizeSelectedGamepadId(gamepadId);
    this.padIndex = null;
    if (persist) {
      saveFlightPreferences({ selectedGamepadId: this.preferredGamepadId });
    }
  }

  getPreferredGamepadId(): string | null {
    return this.preferredGamepadId;
  }

  getActiveGamepadIndex(): number | null {
    return this.padIndex;
  }

  getActiveGamepadId(): string | null {
    return this.getActivePad()?.id ?? null;
  }

  update(): void {
    this.refreshPadIndex();

    if (this.padIndex === null) {
      this.prevButtons = [];
      return;
    }

    const pad = this.getActivePad();
    if (!pad) {
      this.padIndex = null;
      this.prevButtons = [];
      return;
    }

    this.trackSecondaryFire(pad);
    this.trackCameraToggle(pad);
  }

  getPlayerInput(): PlayerInput {
    return playerInputFromFlightInput(this.getFlightInput());
  }

  getFlightInput(): FlightInput {
    this.refreshPadIndex();
    if (this.padIndex === null) return { ...ZERO_FLIGHT_INPUT };

    const pad = this.getActivePad();
    if (!pad) return { ...ZERO_FLIGHT_INPUT };

    const ax = (i: number) => this.applyDeadzone(pad.axes[i] ?? 0);

    const stickX = ax(0);
    const stickY = ax(1);
    const cStickX = pad.axes.length > 2 ? ax(2) : 0;
    const cStickY = pad.axes.length > 3 ? ax(3) : 0;

    const btn = (i: number) => pad.buttons[i]?.pressed ?? false;

    const zHeld = isRollModifierHeld(pad);
    const roll = zHeld ? stickX * 0.85 : 0;
    const pitch = -stickY * 0.9;
    const yaw = zHeld ? 0 : stickX * 0.75;

    const { rTrigger, lTrigger } = readGamepadTriggers(pad);
    const throttle = clamp(rTrigger - lTrigger, -1, 1);

    const toggle = this.cameraToggleQueued;
    const fireSecondaryPressed = this.fireSecondaryQueued;
    this.cameraToggleQueued = false;
    this.fireSecondaryQueued = false;

    return {
      throttle,
      pitch,
      yaw,
      roll,
      boost: rTrigger > 0.95,
      fire: btn(0),
      fireSecondaryPressed,
      toggleSfoilPressed: false,
      cameraToggle: toggle,
      cameraCycle: 0,
      cameraDistance: -cStickY,
      cameraOrbit: cStickX,
      cameraDrop: btn(13) || btn(14),
      cameraProfileCycle: false,
      lookAround: cStickY !== 0 || cStickX !== 0,
    };
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.onGamepadEvent);
      window.removeEventListener('gamepaddisconnected', this.onGamepadEvent);
      window.removeEventListener('pointerdown', this.onUserActivate);
      window.removeEventListener('keydown', this.onUserActivate);
    }
  }

  private attachActivationListeners(): void {
    if (this.activationListenerAttached) return;
    window.addEventListener('pointerdown', this.onUserActivate);
    window.addEventListener('keydown', this.onUserActivate);
    this.activationListenerAttached = true;
  }

  /** Triangle/Y — secondary weapons (one shot per press, Rogue Leader style). */
  private trackSecondaryFire(pad: Gamepad): void {
    const secondaryIndex = 3;
    const pressed = pad.buttons[secondaryIndex]?.pressed ?? false;
    const wasPressed = this.prevButtons[secondaryIndex] ?? false;
    if (pressed && !wasPressed) {
      this.fireSecondaryQueued = true;
    }
  }

  private trackCameraToggle(pad: Gamepad): void {
    for (let i = 0; i < pad.buttons.length; i++) {
      const pressed = pad.buttons[i]?.pressed ?? false;
      const wasPressed = this.prevButtons[i] ?? false;
      if (pressed && !wasPressed && isCameraTogglePressed(pad, i)) {
        this.cameraToggleQueued = true;
        break;
      }
    }
    this.prevButtons = pad.buttons.map((b) => b.pressed);
  }

  private getActivePad(): Gamepad | null {
    if (this.padIndex === null) return null;
    return navigator.getGamepads?.()?.[this.padIndex] ?? null;
  }

  private refreshPadIndex(): void {
    const pads = navigator.getGamepads?.() ?? [];
    this.padIndex = this.resolvePadIndex(pads);
  }

  private pinPadIfEligible(pad: Gamepad): void {
    if (!isUsableGamepad(pad)) return;

    const preferred = this.preferredGamepadId;
    if (preferred !== null) {
      if (gamepadIdsMatch(preferred, pad.id)) {
        this.padIndex = pad.index;
      }
      return;
    }

    if (isPlayStationGamepad(pad) || this.padIndex === null) {
      this.padIndex = pad.index;
    }
  }

  private resolvePadIndex(pads: (Gamepad | null)[]): number | null {
    const preferred = this.preferredGamepadId;

    if (preferred !== null) {
      return pickPreferredGamepadSlot(pads, (pad) =>
        gamepadIdsMatch(preferred, pad.id)
      );
    }

    const playStation = pickPreferredGamepadSlot(pads, (pad) =>
      isPlayStationGamepad(pad)
    );
    if (playStation !== null) return playStation;

    return pickPreferredGamepadSlot(pads, () => true);
  }

  private applyDeadzone(v: number): number {
    return applyRadialDeadzone(v, DEADZONE);
  }
}
