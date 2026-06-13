const STORAGE_KEY = 'rogue-leader-flight';

export interface FlightPreferences {
  autoRoll: boolean;
  /** null = first connected gamepad; otherwise match Gamepad.id exactly. */
  selectedGamepadId: string | null;
}

const DEFAULTS: FlightPreferences = {
  autoRoll: true,
  selectedGamepadId: null,
};

/** Treat empty / junk stored values as automatic selection. */
export function normalizeSelectedGamepadId(
  id: string | null | undefined
): string | null {
  if (id == null) return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }
  return trimmed;
}

export function loadFlightPreferences(): FlightPreferences {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULTS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<FlightPreferences>;
    const selectedGamepadId = normalizeSelectedGamepadId(parsed.selectedGamepadId);
    const result: FlightPreferences = {
      autoRoll: parsed.autoRoll ?? DEFAULTS.autoRoll,
      selectedGamepadId,
    };
    if (parsed.selectedGamepadId !== selectedGamepadId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    }
    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveFlightPreferences(
  partial: Partial<FlightPreferences>
): FlightPreferences {
  const next = { ...loadFlightPreferences(), ...partial };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
