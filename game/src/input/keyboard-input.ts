import type { FlightInput, IInputSource } from './i-input-source';
import type { IPlayerInputSource } from './i-player-input-source';
import { playerInputFromFlightInput, type PlayerInput } from './player-input';

/**
 * Star Wars: Rogue Squadron (PC) default bindings.
 * ↑/I pitch down · ↓/K pitch up · ←/J yaw left · →/L yaw right
 * W thrust · S brake · E+←→ roll · Space/0/Ctrl fire · Alt/Enter secondary
 * X fire mode · F special · Tab look · ~ / F1–F5 views · Z drop cam · F8 cockpit
 */
export class KeyboardInput implements IPlayerInputSource {
  private readonly keys = new Set<string>();
  private cameraToggleQueued = false;
  private cameraCycleQueued = 0;
  private cameraDropQueued = false;
  private fireSecondaryQueued = false;
  private cameraProfileCycleQueued = false;

  constructor() {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);

      if (e.code === 'F8') this.cameraToggleQueued = true;
      if (e.code === 'KeyZ') this.cameraDropQueued = true;
      if (
        e.code === 'F1' ||
        e.code === 'F2' ||
        e.code === 'F3' ||
        e.code === 'F4' ||
        e.code === 'F5'
      ) {
        this.cameraCycleQueued++;
      }
      if (e.code === 'Backquote') this.cameraCycleQueued++;
      if (e.code === 'F6') this.cameraProfileCycleQueued = true;

      if (
        e.code === 'AltLeft' ||
        e.code === 'AltRight' ||
        e.code === 'Enter' ||
        e.code === 'NumpadEnter'
      ) {
        this.fireSecondaryQueued = true;
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.dispose = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }

  private disposeFn: () => void = () => {};

  update(): void {}

  getPlayerInput(): PlayerInput {
    return playerInputFromFlightInput(this.getFlightInput());
  }

  getFlightInput(): FlightInput {
    const pitchDown =
      this.keys.has('ArrowUp') ||
      this.keys.has('KeyI') ||
      this.keys.has('Numpad8');
    const pitchUp =
      this.keys.has('ArrowDown') ||
      this.keys.has('KeyK') ||
      this.keys.has('Numpad2');
    const turnLeft =
      this.keys.has('ArrowLeft') ||
      this.keys.has('KeyJ') ||
      this.keys.has('Numpad4');
    const turnRight =
      this.keys.has('ArrowRight') ||
      this.keys.has('KeyL') ||
      this.keys.has('Numpad6');

    const pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    const turn = (turnRight ? 1 : 0) - (turnLeft ? 1 : 0);

    const rollWithE = this.keys.has('KeyE');
    const yaw = rollWithE ? 0 : turn;
    const roll = rollWithE ? turn : 0;

    const throttle =
      (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);

    const cameraDistance =
      (this.keys.has('PageDown') ? 1 : 0) - (this.keys.has('PageUp') ? 1 : 0);
    const cameraOrbit =
      (this.keys.has('BracketRight') ? 1 : 0) - (this.keys.has('BracketLeft') ? 1 : 0);

    const toggle = this.cameraToggleQueued;
    const cycle = this.cameraCycleQueued;
    const drop = this.cameraDropQueued;
    const fireSecondaryPressed = this.fireSecondaryQueued;
    const cameraProfileCycle = this.cameraProfileCycleQueued;
    this.cameraToggleQueued = false;
    this.cameraCycleQueued = 0;
    this.cameraDropQueued = false;
    this.fireSecondaryQueued = false;
    this.cameraProfileCycleQueued = false;

    return {
      throttle,
      pitch: pitch * 0.85,
      yaw: yaw * 0.85,
      roll: roll * 0.65,
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      fire:
        this.keys.has('Space') ||
        this.keys.has('Digit0') ||
        this.keys.has('ControlLeft') ||
        this.keys.has('ControlRight'),
      fireSecondaryPressed,
      cameraToggle: toggle,
      cameraCycle: cycle,
      cameraProfileCycle,
      cameraDistance,
      cameraOrbit,
      cameraDrop: drop,
      lookAround: this.keys.has('Tab'),
    };
  }

  dispose(): void {
    this.disposeFn();
  }
}
