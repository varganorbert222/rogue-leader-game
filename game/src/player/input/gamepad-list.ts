import { formatGamepadLabel, isUsableGamepad, pickPreferredGamepadSlot } from './gamepad-profiles';

export interface ConnectedGamepadInfo {
  index: number;
  id: string;
  label: string;
}

export function listConnectedGamepads(): ConnectedGamepadInfo[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return [];
  }

  const pads = navigator.getGamepads();
  const seenIds = new Set<string>();
  const result: ConnectedGamepadInfo[] = [];

  for (let index = 0; index < pads.length; index++) {
    const pad = pads[index];
    if (!pad || !isUsableGamepad(pad) || seenIds.has(pad.id)) continue;
    seenIds.add(pad.id);

    const liveIndex =
      pickPreferredGamepadSlot(pads, (candidate) => candidate.id === pad.id) ?? index;
    const live = pads[liveIndex];
    if (!live) continue;

    result.push({
      index: liveIndex,
      id: live.id,
      label: formatGamepadLabel(live),
    });
  }

  return result;
}

/** Poll until at least one pad appears (browser needs a button press first). */
export function wakeGamepads(): void {
  navigator.getGamepads?.();
}
