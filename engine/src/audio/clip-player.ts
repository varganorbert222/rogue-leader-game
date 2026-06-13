import { Scene, Sound, Vector3 } from '@babylonjs/core';
import type { AudioBufferCache } from './audio-buffer-cache';
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
  applySpatialMotionToSound,
  configureSpatialSound,
  resolveSpatialSettings,
  type SpatialAudioSettings,
} from './spatial-audio';
import { warmSound } from './sound-warmup';

interface RegisteredClip extends AudioClipDef {
  id: string;
  urls: string[];
  baseVolume: number;
  spatialSettings: SpatialAudioSettings | null;
}

interface VoiceSlot {
  sound: Sound;
  clipId: string;
  url: string;
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
    private readonly bus: AudioBus,
    private readonly bufferCache: AudioBufferCache
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
      for (const voice of existing) {
        this.bufferCache.untrack(voice.sound);
        voice.sound.dispose();
      }
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
      const soundOptions = this.buildSoundOptions(registered, spatialSettings);
      const sound = this.bufferCache.createSound(
        `clip_${id}_${i}`,
        url,
        this.scene,
        soundOptions,
        spatialSettings
          ? (created) => configureSpatialSound(created, spatialSettings)
          : undefined
      );
      pool.push({ sound, clipId: id, url });
    }
    this.voices.set(id, pool);
  }

  private buildSoundOptions(
    registered: RegisteredClip,
    spatialSettings: SpatialAudioSettings | null
  ): {
    loop: boolean;
    autoplay: boolean;
    volume: number;
    spatialSound?: boolean;
    maxDistance?: number;
    refDistance?: number;
    rolloffFactor?: number;
    distanceModel?: string;
  } {
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
      loop: !!registered.loop,
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

    return soundOptions;
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
      this.pickRandomVoice(pool, clip.urls.length > 1) ??
      pool[0];

    const useSpatial = clip.spatialSettings !== null && options.spatial !== false;
    const position = options.position;

    const pitch = resolvePitchVariation(clip.pitchRange, options.pitch);

    const volume = resolveVolumeVariation(
      clip.baseVolume,
      clip.volumeRange,
      options.volume ?? 1
    );

    if (useSpatial) {
      const sourcePos = position ?? this.listenerPosition;
      const velocity = options.velocity ?? Vector3.Zero();
      applySpatialMotionToSound(
        voice.sound,
        clip.spatialSettings,
        { position: sourcePos, velocity },
        {
          position: this.listenerPosition,
          velocity: this.listenerVelocity,
        },
        pitch,
      );
    } else {
      applySoundPitch(voice.sound, pitch);
    }

    voice.sound.setVolume(this.bus.effectiveSfx() * volume);
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

    const pitch = options.pitch ?? slot.basePitch;
    if (options.position) {
      applySpatialMotionToSound(
        slot.sound,
        slot.spatial,
        {
          position: options.position,
          velocity: options.velocity ?? Vector3.Zero(),
        },
        {
          position: this.listenerPosition,
          velocity: this.listenerVelocity,
        },
        pitch,
      );
    } else {
      applySoundPitch(slot.sound, pitch);
    }
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

  playRandomFile(
    basePath: string,
    files: readonly string[],
    baseUrl: string,
    options: PlayOneShotOptions = {}
  ): void {
    if (!files.length) return;

    const clipId = this.ensureFileVariantClip(basePath, files, baseUrl);
    const pool = this.voices.get(clipId);
    const readyVoice = pool?.find(
      (voice) => !voice.sound.isPlaying && voice.sound.isReady()
    );
    if (readyVoice) {
      this.playOneShot(clipId, options);
      return;
    }

    this.playRandomFileImmediate(basePath, files, baseUrl, options);
  }

  preloadFileVariants(
    basePath: string,
    files: readonly string[],
    baseUrl: string
  ): void {
    if (!files.length) return;
    this.ensureFileVariantClip(basePath, files, baseUrl);
  }

  warmClips(ids: readonly string[]): Promise<void> {
    const unique = [...new Set(ids.filter(Boolean))];
    return Promise.all(unique.map((id) => this.warmClip(id))).then(() => undefined);
  }

  private warmClip(id: string): Promise<void> {
    const clip = this.clips.get(id);
    const pool = this.voices.get(id);
    if (!clip || !pool?.length) return Promise.resolve();

    return this.bufferCache.warmUrls(clip.urls).then(() => {
      const seenUrls = new Set<string>();
      const tasks: Promise<void>[] = [];
      for (const voice of pool) {
        if (seenUrls.has(voice.url)) continue;
        seenUrls.add(voice.url);
        tasks.push(warmSound(voice.sound));
      }
      return Promise.all(tasks);
    }).then(() => undefined);
  }

  private ensureFileVariantClip(
    basePath: string,
    files: readonly string[],
    baseUrl: string
  ): string {
    const clipId = `file_variant_${basePath}_${files.join('|')}`;
    if (this.clips.has(clipId)) return clipId;

    this.registerClip(
      clipId,
      {
        files: [...files],
        volume: 0.9,
        volumeRange: [0.92, 1],
        maxVoices: Math.max(2, files.length),
      },
      basePath,
      baseUrl,
      'sfx'
    );
    return clipId;
  }

  private playRandomFileImmediate(
    basePath: string,
    files: readonly string[],
    baseUrl: string,
    options: PlayOneShotOptions = {}
  ): void {
    if (!files.length) return;

    const file = files[Math.floor(Math.random() * files.length)];
    const url = this.resolveUrl(baseUrl, basePath, file);
    const spatialSettings = resolveSpatialSettings({}, 'sfx');
    const useSpatial = spatialSettings !== null && options.spatial !== false;
    const position = options.position ?? this.listenerPosition;
    const volume = resolveVolumeVariation(1, [0.92, 1], options.volume ?? 1);
    const finalVolume = this.bus.effectiveSfx() * volume;

    this.bufferCache.createSound(
      `variant_${Date.now()}`,
      url,
      this.scene,
      {
        loop: false,
        autoplay: false,
        volume: 0,
        spatialSound: useSpatial && !!spatialSettings,
        maxDistance: spatialSettings?.maxDistance,
        refDistance: spatialSettings?.refDistance,
        rolloffFactor: spatialSettings?.rolloffFactor,
        distanceModel: spatialSettings?.distanceModel,
      },
      (created) => {
        if (useSpatial && spatialSettings) {
          configureSpatialSound(created, spatialSettings);
          created.setPosition(position.clone());
        }
        created.setVolume(finalVolume);
        created.onEndedObservable.addOnce(() => {
          this.bufferCache.untrack(created);
          created.dispose();
        });
        created.play();
      }
    );
  }

  dispose(): void {
    for (const pool of this.voices.values()) {
      for (const voice of pool) {
        this.bufferCache.untrack(voice.sound);
        voice.sound.dispose();
      }
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

  private pickRandomVoice(pool: VoiceSlot[], preferRandom: boolean): VoiceSlot | undefined {
    if (!pool.length) return undefined;
    const idle = pool.filter((voice) => !voice.sound.isPlaying);
    const candidates = idle.length > 0 ? idle : pool;
    if (preferRandom || candidates.length > 1) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return candidates[0];
  }
}

