import { AbstractEngine } from '@babylonjs/core';

export interface CockpitAudioFilterConfig {
  /** Low-pass cutoff in cockpit view (Hz). */
  lowpassHz?: number;
  /** Low-pass cutoff outside cockpit — effectively full bandwidth. */
  chaseLowpassHz?: number;
  /** Wet mix for cabin reverb (0–1). */
  reverbWet?: number;
  /** Seconds to smooth low-pass / reverb transitions. */
  transitionSec?: number;
}

const DEFAULT_CONFIG: Required<CockpitAudioFilterConfig> = {
  lowpassHz: 1500,
  chaseLowpassHz: 20_000,
  reverbWet: 0.12,
  transitionSec: 0.35,
};

/** Short synthetic IR — subtle enclosed-cabin tail without loading assets. */
function createCabinImpulseResponse(
  ctx: AudioContext,
  durationSec = 0.14,
  decay = 2.4,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** decay;
    }
  }
  return buffer;
}

/**
 * Master-bus cockpit colouration: low-pass + light compression + cabin reverb.
 * Inserts between Babylon's masterGain and the audio destination.
 */
export class CockpitAudioFilter {
  private readonly config: Required<CockpitAudioFilterConfig>;
  private installed = false;
  private enabled = false;

  private lowpass: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private convolver: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private outputGain: GainNode | null = null;
  private destination: AudioNode | null = null;

  private currentLowpassHz: number;
  private targetLowpassHz: number;
  private currentReverbWet = 0;
  private targetReverbWet = 0;

  constructor(config: CockpitAudioFilterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentLowpassHz = this.config.chaseLowpassHz;
    this.targetLowpassHz = this.config.chaseLowpassHz;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.targetLowpassHz = enabled
      ? this.config.lowpassHz
      : this.config.chaseLowpassHz;
    this.targetReverbWet = enabled ? this.config.reverbWet : 0;
    this.currentLowpassHz = this.targetLowpassHz;
    this.currentReverbWet = this.targetReverbWet;
    this.ensureInstalled();
    if (this.lowpass) {
      this.lowpass.frequency.value = this.currentLowpassHz;
    }
    if (this.wetGain) {
      this.wetGain.gain.value = this.currentReverbWet;
    }
  }

  update(_dt: number): void {
    // Cockpit filter switches instantly — no smoothing delay.
  }

  dispose(): void {
    const audioEngine = AbstractEngine.audioEngine;
    if (!this.installed || !audioEngine?.canUseWebAudio || !audioEngine.masterGain) {
      this.resetNodes();
      return;
    }

    try {
      audioEngine.masterGain.disconnect();
      audioEngine.masterGain.connect(
        this.destination ?? audioEngine.audioContext!.destination,
      );
    } catch {
      // Graph may already be torn down.
    }

    this.resetNodes();
    this.installed = false;
  }

  private ensureInstalled(): void {
    if (this.installed) return;

    const audioEngine = AbstractEngine.audioEngine;
    const ctx = audioEngine?.audioContext;
    if (!audioEngine?.canUseWebAudio || !ctx || !audioEngine.masterGain) return;

    this.destination = ctx.destination;

    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = this.currentLowpassHz;
    this.lowpass.Q.value = 0.7;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = createCabinImpulseResponse(ctx);

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1;
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = this.currentReverbWet;
    this.outputGain = ctx.createGain();

    try {
      audioEngine.masterGain.disconnect();
    } catch {
      // Not connected yet.
    }

    audioEngine.masterGain.connect(this.lowpass);
    this.lowpass.connect(this.compressor);
    this.compressor.connect(this.dryGain);
    this.compressor.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.outputGain);
    this.wetGain.connect(this.outputGain);
    this.outputGain.connect(this.destination);

    this.installed = true;
  }

  private resetNodes(): void {
    this.lowpass = null;
    this.compressor = null;
    this.convolver = null;
    this.dryGain = null;
    this.wetGain = null;
    this.outputGain = null;
    this.destination = null;
  }
}
