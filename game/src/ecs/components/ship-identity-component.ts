import type { LoadedEntity } from '@rogue-leader/engine';
import type { CombatTeam } from '../../combat/weapons/combat-team';

export interface ShipIdentityComponent {
  shipId: string;
  combatTeam: CombatTeam;
  loadedEntity: LoadedEntity;
}
