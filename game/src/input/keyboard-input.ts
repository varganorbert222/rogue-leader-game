import type { FlightInput, IInputSource } from './i-input-source';
import type { IPlayerInputSource } from './i-player-input-source';
import { playerInputFromFlightInput, type PlayerInput } from './player-input';

/**
 * Rogue Squadron 3D (PC) defaults + Rogue Leader camera keys.
 * Arrows: pitch/yaw · W: thrust · S: brake (min speed) · E+arrows: roll via Q/E
 * Space: fire · Alt: secondary · X: cockpit toggle · F1–F4: camera · Z: drop cam
 */
export class KeyboardInput implements IPlayerInputSource {
  private readonly keys = new Set<string>();
  private cameraToggleQueued = false;
  private cameraCycleQueued = 0;
  private cameraDropQueued = false;

  constructor() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'KeyX') this.cameraToggleQueued = true;
      if (e.code === 'KeyZ') this.cameraDropQueued = true;
      if (e.code === 'F1' || e.code === 'F2' || e.code === 'F3' || e.code === 'F4') {
        this.cameraCycleQueued++;
      }
      if (e.code === 'Backquote') this.cameraCycleQueued++;
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
    const pitch =
      (this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0);
    const yaw =
      (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    const roll =
      (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);

    const throttle =
      (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);

    const cameraDistance =
      (this.keys.has('PageDown') ? 1 : 0) - (this.keys.has('PageUp') ? 1 : 0);
    const cameraOrbit =
      (this.keys.has('BracketRight') ? 1 : 0) - (this.keys.has('BracketLeft') ? 1 : 0);

    const toggle = this.cameraToggleQueued;
    const cycle = this.cameraCycleQueued;
    const drop = this.cameraDropQueued;
    this.cameraToggleQueued = false;
    this.cameraCycleQueued = 0;
    this.cameraDropQueued = false;

    return {
      throttle,
      pitch: pitch * 0.85,
      yaw: yaw * 0.85,
      roll: roll * 0.65,
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      fire: this.keys.has('Space'),
      fireSecondary: this.keys.has('AltLeft') || this.keys.has('AltRight'),
      cameraToggle: toggle,
      cameraCycle: cycle,
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
