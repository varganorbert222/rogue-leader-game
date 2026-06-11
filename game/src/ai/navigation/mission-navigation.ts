import { Vector3 } from '@babylonjs/core';
import type {
  FlockCombatRole,
  FlockNavigationAssignment,
  MissionNavigationConfig,
  NavPathDefinition,
  WanderZoneDefinition,
} from './nav-types';
import { PathFollower } from './path-follower';
import { ZoneWanderer } from './zone-wanderer';

export interface FlockNavigationKit {
  path?: PathFollower;
  wander?: ZoneWanderer;
  combatRole?: FlockCombatRole;
}

/** Resolves mission navigation config into per-flock path / wander helpers. */
export class MissionNavigation {
  constructor(private readonly config?: MissionNavigationConfig) {}

  createFlockKit(
    flockId: string,
    pathArriveRadius: number,
    wanderRetargetRadius: number
  ): FlockNavigationKit {
    const assignment = this.config?.flocks?.[flockId];
    if (!assignment) {
      return {};
    }

    const pathDef = assignment.pathId
      ? this.config?.paths?.[assignment.pathId]
      : undefined;
    const zones = (assignment.zoneIds ?? [])
      .map((id) => this.config?.zones?.[id])
      .filter((z): z is WanderZoneDefinition => z != null);

    return {
      path: pathDef
        ? new PathFollower(pathDef, pathArriveRadius, assignment.pathId)
        : undefined,
      wander:
        zones.length > 0 ? new ZoneWanderer(zones, wanderRetargetRadius) : undefined,
      combatRole: assignment.combatRole,
    };
  }

  getPathDefinition(pathId: string): NavPathDefinition | undefined {
    return this.config?.paths?.[pathId];
  }

  getZoneDefinition(zoneId: string): WanderZoneDefinition | undefined {
    return this.config?.zones?.[zoneId];
  }

  getFlockAssignment(flockId: string): FlockNavigationAssignment | undefined {
    return this.config?.flocks?.[flockId];
  }

  listPathPolylines(): { pathId: string; points: Vector3[] }[] {
    const paths = this.config?.paths;
    if (!paths) return [];
    return Object.entries(paths).map(([pathId, def]) => ({
      pathId,
      points: def.points.map((pt) => Vector3.FromArray(pt)),
    }));
  }

  listZones(): { zoneId: string; zone: WanderZoneDefinition }[] {
    const zones = this.config?.zones;
    if (!zones) return [];
    return Object.entries(zones).map(([zoneId, zone]) => ({ zoneId, zone }));
  }
}
