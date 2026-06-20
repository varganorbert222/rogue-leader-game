/** MVP NPC state ids — extend via mission / behavior JSON later. */
export type NpcStateId = 'patrol' | 'chase' | 'attack';

export type NpcTransitionWhen =
  | 'radar_hostile'
  | 'radar_hostile_close'
  | 'radar_hostile_far'
  | 'radar_clear';

export interface NpcStateParams {
  speedFactor: number;
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;
}

export interface NpcTransitionRule {
  from: NpcStateId;
  to: NpcStateId;
  when: NpcTransitionWhen;
}

export interface NpcBehaviorConfig {
  radarRadius: number;
  attackEnterRange: number;
  attackExitRange: number;
  loseRadarRange: number;
  fireRange: number;
  pathArriveRadius: number;
  wanderRetargetRadius: number;
  states: Record<NpcStateId, NpcStateParams>;
  transitions: NpcTransitionRule[];
  initialState: NpcStateId;
}

export const DEFAULT_NPC_BEHAVIOR_CONFIG: NpcBehaviorConfig = {
  radarRadius: 175,
  attackEnterRange: 100,
  attackExitRange: 130,
  loseRadarRange: 220,
  fireRange: 140,
  pathArriveRadius: 45,
  wanderRetargetRadius: 35,
  initialState: 'patrol',
  states: {
    patrol: {
      speedFactor: 0.75,
      separationWeight: 2.8,
      alignmentWeight: 0.9,
      cohesionWeight: 0.7,
    },
    chase: {
      speedFactor: 1.0,
      separationWeight: 2.4,
      alignmentWeight: 0.6,
      cohesionWeight: 0.5,
    },
    attack: {
      speedFactor: 1.2,
      separationWeight: 2.0,
      alignmentWeight: 0.3,
      cohesionWeight: 0.2,
    },
  },
  transitions: [
    { from: 'patrol', to: 'chase', when: 'radar_hostile' },
    { from: 'chase', to: 'attack', when: 'radar_hostile_close' },
    { from: 'attack', to: 'chase', when: 'radar_hostile_far' },
    { from: 'chase', to: 'patrol', when: 'radar_clear' },
    { from: 'attack', to: 'patrol', when: 'radar_clear' },
  ],
};

export async function loadNpcBehaviorConfig(url: string): Promise<NpcBehaviorConfig> {
  try {
    const res = await fetch(url);
    if (!res.ok) return DEFAULT_NPC_BEHAVIOR_CONFIG;
    const data = (await res.json()) as Partial<NpcBehaviorConfig>;
    return {
      ...DEFAULT_NPC_BEHAVIOR_CONFIG,
      ...data,
      states: {
        ...DEFAULT_NPC_BEHAVIOR_CONFIG.states,
        ...data.states,
      },
      transitions: data.transitions ?? DEFAULT_NPC_BEHAVIOR_CONFIG.transitions,
    };
  } catch {
    return DEFAULT_NPC_BEHAVIOR_CONFIG;
  }
}
