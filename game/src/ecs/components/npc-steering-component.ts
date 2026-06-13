import type { NpcInput } from '../../player/input/npc-input';

export interface NpcSteeringComponent {
  flockId: string;
  input: NpcInput;
}
