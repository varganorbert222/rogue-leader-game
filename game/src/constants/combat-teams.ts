export const CombatTeams = {
  Player: 'player',
  Enemy: 'enemy',
  Neutral: 'neutral',
} as const;

export type CombatTeamId = (typeof CombatTeams)[keyof typeof CombatTeams];
