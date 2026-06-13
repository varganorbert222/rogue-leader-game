import type { MissionWave } from '../../mission-types';

/** Waves defined in mission config (may be empty). */
export function missionWaves(waves?: MissionWave[]): MissionWave[] {
  return waves ?? [];
}

/** Configured wave count (0 when none defined). */
export function missionWaveCount(waves?: MissionWave[]): number {
  return missionWaves(waves).length;
}

/** HUD display total — at least 1 so UI never shows `/0`. */
export function hudTotalWaves(waves?: MissionWave[]): number {
  return Math.max(1, missionWaveCount(waves));
}

/** 1-based wave label for HUD. */
export function hudCurrentWave(
  wavesSpawned: number,
  waves?: MissionWave[],
): number {
  const total = missionWaveCount(waves);
  if (total === 0) return 1;
  if (wavesSpawned <= 0) return 1;
  return Math.min(wavesSpawned, total);
}
