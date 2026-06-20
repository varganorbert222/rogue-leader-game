/** Projectile behavior ids from weapons manifest — used for routing and hit SFX. */
export const ProjectileBehaviors = {
  Bolt: 'bolt',
  Bomb: 'bomb',
  Rocket: 'rocket',
  MissileUnguided: 'missile_unguided',
  MissileHoming: 'missile_homing',
} as const;

export type ProjectileBehaviorId =
  (typeof ProjectileBehaviors)[keyof typeof ProjectileBehaviors];

const MISSILE_HIT_BEHAVIORS: ReadonlySet<string> = new Set([
  ProjectileBehaviors.MissileHoming,
  ProjectileBehaviors.MissileUnguided,
  ProjectileBehaviors.Rocket,
  ProjectileBehaviors.Bomb,
]);

export function isMissileHitBehavior(behavior?: string): boolean {
  return behavior != null && MISSILE_HIT_BEHAVIORS.has(behavior);
}

export const AmmoIds = {
  ProtonTorpedo: 'proton_torpedo',
} as const;
