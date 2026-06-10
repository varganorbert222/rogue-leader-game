import { mergeFlightInputs, type FlightInput, type IInputSource } from './i-input-source';

/** Merges keyboard + gamepad; strongest analog axis wins per channel. */
export class CombinedInput implements IInputSource {
  constructor(private readonly sources: IInputSource[]) {}

  update(): void {
    for (const source of this.sources) source.update();
  }

  getFlightInput(): FlightInput {
    return mergeFlightInputs(this.sources.map((s) => s.getFlightInput()));
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}
