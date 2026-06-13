export const ActorRoles = {
  Player: 'player',
  Npc: 'npc',
} as const;

export type ActorRoleId = (typeof ActorRoles)[keyof typeof ActorRoles];
