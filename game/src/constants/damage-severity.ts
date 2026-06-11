export const DamageSeverities = {
  Shield: 'shield',
  Hull: 'hull',
  Meteor: 'meteor',
} as const;

export type DamageSeverity =
  (typeof DamageSeverities)[keyof typeof DamageSeverities];
