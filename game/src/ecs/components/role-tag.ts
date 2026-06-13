export const Role = {
  Player: 'player',
  Npc: 'npc',
  Asteroid: 'asteroid',
} as const;

export type Role = (typeof Role)[keyof typeof Role];
