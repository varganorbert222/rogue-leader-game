export const MissionIds = {
  AsteroidFieldSpace: 'asteroid_field_space',
  HothSurface: 'mission_02_hoth_surface',
  Tatooine: 'mission_03_tatooine',
} as const;

export type MissionId = (typeof MissionIds)[keyof typeof MissionIds];

export const DEFAULT_MISSION_ID = MissionIds.AsteroidFieldSpace;

export const WinConditionTypes = {
  DestroyAllEnemies: 'destroy_all_enemies',
} as const;

export type WinConditionType =
  (typeof WinConditionTypes)[keyof typeof WinConditionTypes];
