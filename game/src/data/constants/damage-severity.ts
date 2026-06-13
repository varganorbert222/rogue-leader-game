export const DamageSeverities = {
  Shield: "shield",
  Hull: "hull",
  Asteroid: "asteroid",
} as const;

export type DamageSeverity =
  (typeof DamageSeverities)[keyof typeof DamageSeverities];
