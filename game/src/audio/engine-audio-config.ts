/** Engine loop pitch mapping from normalized speed (0 = min speed, 1 = max speed). */
export interface EngineAudioConfig {
  speedPitchMin: number;
  speedPitchMax: number;
}

export const DEFAULT_ENGINE_AUDIO_CONFIG: EngineAudioConfig = {
  speedPitchMin: 0.5,
  speedPitchMax: 1.1,
};

export function resolveEngineAudioConfig(
  partial?: Partial<EngineAudioConfig>
): EngineAudioConfig {
  return {
    speedPitchMin: partial?.speedPitchMin ?? DEFAULT_ENGINE_AUDIO_CONFIG.speedPitchMin,
    speedPitchMax: partial?.speedPitchMax ?? DEFAULT_ENGINE_AUDIO_CONFIG.speedPitchMax,
  };
}

/** Map speed ratio T ∈ [0, 1] to playback pitch. */
export function enginePitchFromSpeedRatio(
  speedRatio: number,
  config: EngineAudioConfig
): number {
  const t = Math.max(0, Math.min(1, speedRatio));
  return config.speedPitchMin + t * (config.speedPitchMax - config.speedPitchMin);
}

export function computeEngineSpeedRatio(
  speed: number,
  minSpeed: number,
  maxSpeed: number
): number {
  const span = Math.max(1e-6, maxSpeed - minSpeed);
  return Math.max(0, Math.min(1, (speed - minSpeed) / span));
}
