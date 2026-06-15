/** Optional mission spawn / respawn rules (testing hooks — off by default). */
export interface MissionSpawnPolicy {
  /** Show ship picker before the first player spawn. */
  shipSelectBeforeSpawn?: boolean;
  /** On player death, return to ship picker instead of mission fail. */
  respawnOnDeath?: boolean;
}

export const DEFAULT_MISSION_SPAWN_POLICY: MissionSpawnPolicy = {};

export function resolveMissionSpawnPolicy(
  config?: MissionSpawnPolicy,
): MissionSpawnPolicy {
  return {
    shipSelectBeforeSpawn: config?.shipSelectBeforeSpawn ?? false,
    respawnOnDeath: config?.respawnOnDeath ?? false,
  };
}

export function isShipSelectionEnabled(policy: MissionSpawnPolicy): boolean {
  return !!(policy.shipSelectBeforeSpawn || policy.respawnOnDeath);
}
