import { Scene, Sound, Vector3 } from '@babylonjs/core';
import type { AudioBus } from './audio-bus';
import type {
  AudioClipDef,
  AudioLibraryCategory,
  LegacySfxEntry,
  LoopTransformOptions,
  PlayOneShotOptions,
  StartLoopOptions,
} from './audio-types';
import {
  applySoundPitch,
  resolvePitchVariation,
  resolveVolumeVariation,
} from './sound-variation';
import {
  computeDopplerPitch,
  configureSpatialSound,
  resolveSpatialSettings,
  type SpatialAudioSettings,
} from './spatial-audio';

interface RegisteredClip extends AudioClipDef {
  id: string;
  urls: string[];
  baseVolume: number;
  spatialSettings: SpatialAudioSettings | null;
}

interface VoiceSlot {
  sound: Sound;
  clipId: string;
}

interface LoopSlot {
  sound: Sound;
  clipId: string;
  spatial: SpatialAudioSettings | null;
  basePitch: number;
}

export class ClipPlayer {
  private readonly clips = new Map<string, RegisteredClip>();
  private readonly voices = new Map<string, VoiceSlot[]>();
  private readonly loops = new Map<string, LoopSlot>();
  private readonly lastPlayed = new Map<string, number>();
  private loopCounter = 0;
  private listenerPosition = Vector3.Zero();
  private listenerVelocity = Vector3.Zero();

  constructor(
    private readonly scene: Scene,
    private readonly bus: AudioBus
  ) {
    this.scene.audioPositioningRefreshRate = 0;
  }

  setListenerState(position: Vector3, velocity: Vector3): void {
    this.listenerPosition.copyFrom(position);
    this.listenerVelocity.copyFrom(velocity);
  }

  registerLegacy(id: string, entry: LegacySfxEntry, baseUrl: string): void {
    const normalized = entry.path.replace(/\\/g, '/');
    const slash = normalized.lastIndexOf('/');
    const basePath = slash >= 0 ? normalized.slice(0, slash) : 'audio/sfx';
    const file = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    this.registerClip(
      id,
      {
        files: [file],
        volume: entry.volume,
        cooldownMs: entry.cooldownMs,
        maxVoices: 4,
      },
      basePath,
      baseUrl,
      'sfx'
    );
  }

  registerFromLibrary(
    clipId: string,
    def: AudioClipDef,
    basePath: string,
    baseUrl: string,
    category?: AudioLibraryCategory
  ): void {
    this.registerClip(clipId, def, basePath, baseUrl, category);
  }

  private registerClip(
    id: string,
    def: AudioClipDef,
    basePath: string,
    baseUrl: string,
    category?: AudioLibraryCategory
  ): void {
    const existing = this.voices.get(id);
    if (existing) {
      for (const voice of existing) voice.sound.dispose();
      this.voices.delete(id);
    }

    const urls = (def.files ?? []).map((file) => this.resolveUrl(baseUrl, basePath, file));
    if (!urls.length) return;

    const spatialSettings = resolveSpatialSettings(def, category);
    const registered: RegisteredClip = {
      ...def,
      id,
      urls,
      baseVolume: def.volume ?? 1,
      spatialSettings,
    };
    this.clips.set(id, registered);

    const voiceCount = def.loop
      ? Math.max(1, def.maxVoices ?? 12)
      : Math.max(1, def.maxVoices ?? 4);
    const pool: VoiceSlot[] = [];
    for (let i = 0; i < voiceCount; i++) {
      const url = urls[i % urls.length];
      const soundOptions: {
        loop: boolean;
        autoplay: boolean;
        volume: number;
        spatialSound?: boolean;
        maxDistance?: number;
        refDistance?: number;
        rolloffFactor?: number;
        distanceModel?: string;
      } = {
        loop: !!def.loop,
        autoplay: false,
        volume: registered.baseVolume,
      };

      if (spatialSettings) {
        soundOptions.spatialSound = true;
        soundOptions.maxDistance = spatialSettings.maxDistance;
        soundOptions.refDistance = spatialSettings.refDistance;
        soundOptions.rolloffFactor = spatialSettings.rolloffFactor;
        soundOptions.distanceModel = spatialSettings.distanceModel;
      }

      const sound = new Sound(`clip_${id}_${i}`, url, this.scene, undefined, soundOptions);
      if (spatialSettings) configureSpatialSound(sound, spatialSettings);
      pool.push({ sound, clipId: id });
    }
    this.voices.set(id, pool);
  }

  playOneShot(id: string, options: PlayOneShotOptions = {}): void {
    const clip = this.clips.get(id);
    if (!clip || clip.loop) return;

    const now = performance.now();
    const cd = options.cooldownMs ?? clip.cooldownMs ?? 0;
    const last = this.lastPlayed.get(id) ?? 0;
    if (cd > 0 && now - last < cd) return;

    const pool = this.voices.get(id);
    if (!pool?.length) return;

    const voice =
      pool.find((v) => !v.sound.isPlaying) ??
      pool[Math.floor(Math.random() * pool.length)];

    const useSpatial = clip.spatialSettings !== null && options.spatial !== false;
    const position = options.position;

    let pitch = resolvePitchVariation(clip.pitchRange, options.pitch);
    if (useSpatial && clip.spatialSettings?.doppler) {
      const sourcePos = position ?? this.listenerPosition;
      const velocity = options.velocity ?? Vector3.Zero();
      const doppler = computeDopplerPitch(
        sourcePos,
        velocity,
        this.listenerPosition,
        this.listenerVelocity
      );
      pitch *= doppler;
    }

    const volume = resolveVolumeVariation(
      clip.baseVolume,
      clip.volumeRange,
      options.volume ?? 1
    );

    if (useSpatial) {
      voice.sound.setPosition(position ?? this.listenerPosition.clone());
    }

    voice.sound.setVolume(this.bus.effectiveSfx() * volume);
    applySoundPitch(voice.sound, pitch);
    if (voice.sound.isPlaying) voice.sound.stop();
    voice.sound.play();
    this.lastPlayed.set(id, now);
  }

  startLoop(id: string, options: StartLoopOptions = {}): string {
    const clip = this.clips.get(id);
    if (!clip) return '';

    const pool = this.voices.get(id);
    if (!pool?.length) return '';

    const voice = pool.find((slot) => !this.isLoopVoiceBusy(slot.sound)) ?? pool[0];
    const sound = voice.sound;
    const volumeScale = options.volumeScale ?? 1;

    const handle = `loop_${id}_${this.loopCounter++}`;
    sound.setVolume(this.bus.effectiveSfx() * clip.baseVolume * volumeScale);

    if (options.position) {
      sound.setPosition(options.position);
    }

    if (!sound.isPlaying) sound.play();
    this.loops.set(handle, {
      sound,
      clipId: id,
      spatial: clip.spatialSettings,
      basePitch: 1,
    });

    this.applyLoopTransform(handle, {
      volumeScale: options.volumeScale,
      pitch: options.pitch,
      position: options.position,
      velocity: options.velocity,
    });

    return handle;
  }

  private isLoopVoiceBusy(sound: Sound): boolean {
    for (const active of this.loops.values()) {
      if (active.sound === sound) return true;
    }
    return false;
  }

  setLoopTransform(handle: string, options: LoopTransformOptions): void {
    this.applyLoopTransform(handle, options);
  }

  private applyLoopTransform(handle: string, options: LoopTransformOptions): void {
    const slot = this.loops.get(handle);
    if (!slot) return;

    const clip = this.clips.get(slot.clipId);
    if (!clip) return;

    if (options.volumeScale !== undefined) {
      slot.sound.setVolume(
        this.bus.effectiveSfx() * clip.baseVolume * options.volumeScale
      );
    }

    if (options.position) {
      slot.sound.setPosition(options.position);
    }

    let pitch = options.pitch ?? slot.basePitch;
    if (slot.spatial?.doppler && options.position) {
      const velocity = options.velocity ?? Vector3.Zero();
      pitch *= computeDopplerPitch(
        options.position,
        velocity,
        this.listenerPosition,
        this.listenerVelocity
      );
    }
    applySoundPitch(slot.sound, pitch);
  }

  /** @deprecated Use setLoopTransform */
  setLoopVolume(handle: string, volumeScale: number): void {
    this.setLoopTransform(handle, { volumeScale });
  }

  stopLoop(handle: string): void {
    const slot = this.loops.get(handle);
    if (!slot) return;
    slot.sound.stop();
    this.loops.delete(handle);
  }

  hasClip(id: string): boolean {
    return this.clips.has(id);
  }

  dispose(): void {
    for (const pool of this.voices.values()) {
      for (const voice of pool) voice.sound.dispose();
    }
    this.voices.clear();
    this.clips.clear();
    this.loops.clear();
    this.lastPlayed.clear();
  }

  private resolveUrl(baseUrl: string, basePath: string, file: string): string {
    const path = `${baseUrl}/${basePath}/${file}`.replace(/\/+/g, '/').replace(':/', '://');
    return path;
  }
}
