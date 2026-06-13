const STORAGE_KEY = "rogue-leader-debug";

export interface DebugOverlayToggles {
  worldAxes: boolean;
  shipAxes: boolean;
  playVolumeGrid: boolean;
  navPaths: boolean;
  navWaypoints: boolean;
  wanderZones3d: boolean;
  npcRadarRings: boolean;
  npcSteeringVectors: boolean;
  playerAimVectors: boolean;
  playerRadarRing: boolean;
  vehicleWireframes: boolean;
  projectileGizmos: boolean;
  asteroidWireframes: boolean;
  colliderWireframes: boolean;
}

export interface DebugLabelToggles {
  enabled: boolean;
  vehicles: boolean;
  projectiles: boolean;
  navWaypoints: boolean;
  navPaths: boolean;
  wanderZones: boolean;
  asteroids: boolean;
  npcActors: boolean;
}

export interface DebugGameplayToggles {
  invincible: boolean;
}

export interface DebugPreferences {
  masterEnabled: boolean;
  overlays: DebugOverlayToggles;
  labels: DebugLabelToggles;
  gameplay: DebugGameplayToggles;
}

export const DEFAULT_DEBUG_PREFERENCES: DebugPreferences = {
  masterEnabled: true,
  overlays: {
    worldAxes: true,
    shipAxes: true,
    playVolumeGrid: true,
    navPaths: true,
    navWaypoints: true,
    wanderZones3d: true,
    npcRadarRings: true,
    npcSteeringVectors: true,
    playerAimVectors: true,
    playerRadarRing: true,
    vehicleWireframes: true,
    projectileGizmos: true,
    asteroidWireframes: true,
    colliderWireframes: false,
  },
  labels: {
    enabled: true,
    vehicles: true,
    projectiles: true,
    navWaypoints: true,
    navPaths: true,
    wanderZones: true,
    asteroids: true,
    npcActors: true,
  },
  gameplay: {
    invincible: true,
  },
};

export function loadDebugPreferences(): DebugPreferences {
  if (typeof localStorage === "undefined") {
    return cloneDebugPreferences(DEFAULT_DEBUG_PREFERENCES);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDebugPreferences(DEFAULT_DEBUG_PREFERENCES);
    const parsed = JSON.parse(raw) as Partial<DebugPreferences>;
    return mergeDebugPreferences(DEFAULT_DEBUG_PREFERENCES, parsed);
  } catch {
    return cloneDebugPreferences(DEFAULT_DEBUG_PREFERENCES);
  }
}

export function saveDebugPreferences(
  partial: Partial<DebugPreferences>,
): DebugPreferences {
  const next = mergeDebugPreferences(loadDebugPreferences(), partial);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function cloneDebugPreferences(
  prefs: DebugPreferences,
): DebugPreferences {
  return mergeDebugPreferences(DEFAULT_DEBUG_PREFERENCES, prefs);
}

function mergeDebugPreferences(
  base: DebugPreferences,
  partial: Partial<DebugPreferences>,
): DebugPreferences {
  return {
    masterEnabled: partial.masterEnabled ?? base.masterEnabled,
    overlays: { ...base.overlays, ...partial.overlays },
    labels: { ...base.labels, ...partial.labels },
    gameplay: { ...base.gameplay, ...partial.gameplay },
  };
}
