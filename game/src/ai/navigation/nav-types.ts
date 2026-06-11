/** Waypoint path defined in mission config. */
export interface NavPathDefinition {
  points: [number, number, number][];
  loop?: boolean;
}

export type WanderZoneDefinition =
  | {
      type: 'sphere';
      center: [number, number, number];
      radius: number;
    }
  | {
      type: 'cube';
      center: [number, number, number];
      halfExtents: [number, number, number];
    };

/** How a flock reacts when it detects the player. */
export type FlockCombatRole = 'patrol_only' | 'wander_guard' | 'hunter';

/** Per-flock navigation assignment (shared by all flock members). */
export interface FlockNavigationAssignment {
  pathId?: string;
  zoneIds?: string[];
  combatRole?: FlockCombatRole;
}

export interface MissionNavigationConfig {
  paths?: Record<string, NavPathDefinition>;
  zones?: Record<string, WanderZoneDefinition>;
  flocks?: Record<string, FlockNavigationAssignment>;
}
