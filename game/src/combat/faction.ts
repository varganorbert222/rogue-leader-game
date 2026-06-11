export type FactionId = 'rebel' | 'imperial' | 'neutral';

export function resolveFaction(faction?: FactionId): FactionId {
  return faction ?? 'neutral';
}

/** Rebel and imperial are hostile to each other; neutral is non-hostile to all. */
export function areFactionsHostile(a: FactionId, b: FactionId): boolean {
  if (a === 'neutral' || b === 'neutral') return false;
  return a !== b;
}

/** Same non-neutral faction — friendly fire is allowed, auto-aim is not. */
export function areFactionsAllied(a: FactionId, b: FactionId): boolean {
  if (a === 'neutral' || b === 'neutral') return false;
  return a === b;
}

/** Targeting / weapon auto-aim may only lock hostile factions (all allegiances). */
export function isAutoAimCandidate(observer: FactionId, candidate: FactionId): boolean {
  return areFactionsHostile(observer, candidate);
}
