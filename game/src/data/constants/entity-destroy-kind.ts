export const EntityDestroyKinds = {
  Fighter: 'fighter',
  Asteroid: 'asteroid',
} as const;

export type EntityDestroyKind =
  (typeof EntityDestroyKinds)[keyof typeof EntityDestroyKinds];
