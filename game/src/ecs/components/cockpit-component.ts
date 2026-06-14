import type { CockpitAttachment, ResolvedCockpitConfig } from '@rogue-leader/engine';

/** Player-only interior cockpit — attached dynamically, not part of ship templates. */
export interface CockpitComponent {
  attachment: CockpitAttachment;
  config: ResolvedCockpitConfig;
}
