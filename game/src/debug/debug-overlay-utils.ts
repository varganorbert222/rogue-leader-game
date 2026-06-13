import type { DebugPreferences } from './debug-preferences';

export function hasActiveDebugWork(prefs: DebugPreferences): boolean {
  if (!prefs.masterEnabled) return false;
  if (prefs.labels.enabled) return true;
  return Object.values(prefs.overlays).some(Boolean);
}

export function needsNpcDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.npcRadarRings ||
    prefs.overlays.npcSteeringVectors ||
    (prefs.labels.enabled && prefs.labels.npcActors)
  );
}

export function needsProjectileDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.projectileGizmos ||
    (prefs.labels.enabled && prefs.labels.projectiles)
  );
}

export function needsMeshWireframeColliderData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.colliderWireframes ||
    prefs.overlays.vehicleWireframes ||
    prefs.overlays.asteroidWireframes
  );
}

export function needsColliderDebugData(prefs: DebugPreferences): boolean {
  return needsMeshWireframeColliderData(prefs);
}

export function needsAsteroidDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.asteroidWireframes ||
    prefs.overlays.colliderWireframes ||
    (prefs.labels.enabled && prefs.labels.asteroids)
  );
}

export function needsVehicleDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.vehicleWireframes ||
    prefs.overlays.colliderWireframes ||
    (prefs.labels.enabled && prefs.labels.vehicles)
  );
}

export function needsNavDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.navPaths ||
    prefs.overlays.navWaypoints ||
    (prefs.labels.enabled && (prefs.labels.navPaths || prefs.labels.navWaypoints))
  );
}

export function needsZoneDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.wanderZones3d ||
    (prefs.labels.enabled && prefs.labels.wanderZones)
  );
}

export function needsPlayerAimDebugData(prefs: DebugPreferences): boolean {
  return (
    prefs.overlays.playerAimVectors ||
    prefs.overlays.playerRadarRing
  );
}
