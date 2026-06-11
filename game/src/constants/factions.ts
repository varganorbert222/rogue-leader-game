export const Factions = {
  Rebel: 'rebel',
  Imperial: 'imperial',
  Neutral: 'neutral',
} as const;

export type FactionIdConst = (typeof Factions)[keyof typeof Factions];
