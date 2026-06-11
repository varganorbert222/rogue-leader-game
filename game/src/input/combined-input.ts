import { mergeFlightInputs, type FlightInput } from './i-input-source';
import type { IPlayerInputSource } from './i-player-input-source';
import { mergePlayerInputs, type PlayerInput } from './player-input';

/** Merges keyboard + gamepad; strongest analog axis wins per channel. */
export class CombinedInput implements IPlayerInputSource {
  constructor(private readonly sources: IPlayerInputSource[]) {}

  update(): void {
    for (const source of this.sources) source.update();
  }

  getPlayerInput(): PlayerInput {
    return mergePlayerInputs(this.sources.map((s) => s.getPlayerInput()));
  }

  getFlightInput(): FlightInput {
    return mergeFlightInputs(this.sources.map((s) => s.getFlightInput()));
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}
