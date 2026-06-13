import { TargetingSystem } from '../../combat/targeting/targeting-system';
import type { WeaponAimDebugInfo } from '../../combat/targeting/weapon-aim-controller';

export interface TargetingComponent {
  system: TargetingSystem;
  lastAimDebug: WeaponAimDebugInfo | null;
}

export function createTargetingComponent(): TargetingComponent {
  return { system: new TargetingSystem(), lastAimDebug: null };
}
