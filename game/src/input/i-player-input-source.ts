import type { IInputSource } from './i-input-source';
import type { PlayerInput } from './player-input';

/** Human input devices that produce split player vehicle/combat/camera channels. */
export interface IPlayerInputSource extends IInputSource {
  getPlayerInput(): PlayerInput;
}
