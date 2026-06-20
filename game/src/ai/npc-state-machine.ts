import type {
  NpcBehaviorConfig,
  NpcStateId,
  NpcTransitionWhen,
} from '../config/loaders/npc-behavior-config';

export interface NpcRadarContext {
  hostileDistance: number;
}

/** Config-driven MVP state machine for NPC behavior. */
export class NpcStateMachine {
  private state: NpcStateId;

  constructor(private readonly config: NpcBehaviorConfig) {
    this.state = config.initialState;
  }

  getState(): NpcStateId {
    return this.state;
  }

  setState(state: NpcStateId): void {
    this.state = state;
  }

  update(radar: NpcRadarContext): NpcStateId {
    for (const rule of this.config.transitions) {
      if (rule.from !== this.state) continue;
      if (!this.matchesCondition(rule.when, radar)) continue;
      this.state = rule.to;
      break;
    }
    return this.state;
  }

  getStateParams() {
    return this.config.states[this.state];
  }

  private matchesCondition(when: NpcTransitionWhen, radar: NpcRadarContext): boolean {
    const d = radar.hostileDistance;
    const c = this.config;

    switch (when) {
      case 'radar_hostile':
        return d <= c.radarRadius;
      case 'radar_hostile_close':
        return d <= c.attackEnterRange;
      case 'radar_hostile_far':
        return d > c.attackExitRange && d <= c.radarRadius;
      case 'radar_clear':
        return d > c.loseRadarRange;
      default:
        return false;
    }
  }
}
