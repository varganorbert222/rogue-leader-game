export const ShipIds = {
  Xwing: 'xwing',
  TieFighter: 'tie_fighter',
} as const;

export type ShipId = (typeof ShipIds)[keyof typeof ShipIds];

export const DEFAULT_PLAYER_SHIP_ID = ShipIds.Xwing;
