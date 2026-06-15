import { RuntimePaths } from '../runtime-paths';
import {
  color4,
  defaultParticleEffect,
  type ParticleEffectEditable,
  type ParticlePresetEntry,
  vec3,
} from './particle-editor-types';

const EXPLOSION_SYSTEM = {
  id: 'ps_explosion',
  name: 'Burst',
  capacity: 120,
  texture: 'flare' as const,
  playMode: 'burst' as const,
  minEmitBox: vec3(),
  maxEmitBox: vec3(),
  color1: color4(1, 0.6, 0.1, 1),
  color2: color4(1, 0.2, 0, 0.5),
  colorDead: color4(0, 0, 0, 0),
  minSize: 0.3,
  maxSize: 1.2,
  minLifeTime: 0.2,
  maxLifeTime: 0.6,
  emitRate: 800,
  manualEmitCount: 120,
  targetStopDuration: 0.5,
  blendMode: 'add' as const,
  direction1: vec3(-1, -1, -1),
  direction2: vec3(1, 1, 1),
  gravity: vec3(),
  minAngularSpeed: 0,
  maxAngularSpeed: 0,
  minEmitPower: 1,
  maxEmitPower: 1,
  updateSpeed: 1,
  startDelay: 0,
  disposeOnStop: false,
};

const DEBRIS_SMOKE_SYSTEM = {
  id: 'ps_debris_smoke',
  name: 'Smoke',
  capacity: 60,
  texture: 'flare' as const,
  playMode: 'loop' as const,
  minEmitBox: vec3(-0.15, -0.15, -0.15),
  maxEmitBox: vec3(0.15, 0.15, 0.15),
  color1: color4(0.35, 0.35, 0.35, 0.55),
  color2: color4(0.15, 0.15, 0.15, 0),
  colorDead: color4(0, 0, 0, 0),
  minSize: 0.25,
  maxSize: 1.1,
  minLifeTime: 0.6,
  maxLifeTime: 1.8,
  emitRate: 35,
  manualEmitCount: 0,
  targetStopDuration: 0,
  blendMode: 'standard' as const,
  direction1: vec3(-0.25, 0.4, -0.25),
  direction2: vec3(0.25, 1.2, 0.25),
  gravity: vec3(0, 0.4, 0),
  minAngularSpeed: 0,
  maxAngularSpeed: 0,
  minEmitPower: 1,
  maxEmitPower: 1,
  updateSpeed: 1,
  startDelay: 0,
  disposeOnStop: false,
};

const BUILTIN_PRESETS: ParticlePresetEntry[] = [
  {
    id: 'explosion',
    label: 'Explosion burst',
    effect: {
      id: 'preset_explosion',
      name: 'Explosion',
      systems: [{ ...EXPLOSION_SYSTEM }],
    },
  },
  {
    id: 'hit_spark',
    label: 'Hit spark',
    effect: {
      id: 'preset_hit_spark',
      name: 'Hit Spark',
      systems: [
        {
          id: 'ps_hit_spark',
          name: 'Spark',
          capacity: 30,
          texture: 'flare',
          playMode: 'burst',
          minEmitBox: vec3(),
          maxEmitBox: vec3(),
          color1: color4(0.5, 0.8, 1, 1),
          color2: color4(1, 1, 1, 0),
          colorDead: color4(0, 0, 0, 0),
          minSize: 0.1,
          maxSize: 0.4,
          minLifeTime: 0.05,
          maxLifeTime: 0.2,
          emitRate: 200,
          manualEmitCount: 30,
          targetStopDuration: 0.15,
          blendMode: 'add',
          direction1: vec3(-1, -1, -1),
          direction2: vec3(1, 1, 1),
          gravity: vec3(),
          minAngularSpeed: 0,
          maxAngularSpeed: 0,
          minEmitPower: 1,
          maxEmitPower: 1,
          updateSpeed: 1,
          startDelay: 0,
          disposeOnStop: false,
        },
      ],
    },
  },
  {
    id: 'debris_smoke',
    label: 'Debris smoke',
    effect: {
      id: 'preset_debris_smoke',
      name: 'Debris Smoke',
      systems: [{ ...DEBRIS_SMOKE_SYSTEM }],
    },
  },
  {
    id: 'debris_fire',
    label: 'Debris fire',
    effect: {
      id: 'preset_debris_fire',
      name: 'Debris Fire',
      systems: [
        {
          id: 'ps_debris_fire',
          name: 'Fire',
          capacity: 80,
          texture: 'flare',
          playMode: 'loop',
          minEmitBox: vec3(-0.1, -0.1, -0.1),
          maxEmitBox: vec3(0.1, 0.1, 0.1),
          color1: color4(1, 0.75, 0.15, 0.95),
          color2: color4(0.9, 0.15, 0, 0),
          colorDead: color4(0, 0, 0, 0),
          minSize: 0.15,
          maxSize: 0.75,
          minLifeTime: 0.15,
          maxLifeTime: 0.55,
          emitRate: 90,
          manualEmitCount: 0,
          targetStopDuration: 0,
          blendMode: 'add',
          direction1: vec3(-0.35, -0.15, -0.35),
          direction2: vec3(0.35, 0.45, 0.35),
          gravity: vec3(0, 0.15, 0),
          minAngularSpeed: 0,
          maxAngularSpeed: 0,
          minEmitPower: 1,
          maxEmitPower: 1,
          updateSpeed: 1,
          startDelay: 0,
          disposeOnStop: false,
        },
      ],
    },
  },
  {
    id: 'explosion_combo',
    label: 'Explosion + smoke (multi-system)',
    effect: {
      id: 'preset_explosion_combo',
      name: 'Explosion Combo',
      systems: [
        { ...EXPLOSION_SYSTEM, id: 'ps_combo_burst', name: 'Burst' },
        {
          ...DEBRIS_SMOKE_SYSTEM,
          id: 'ps_combo_smoke',
          name: 'Smoke trail',
          playMode: 'burst',
          manualEmitCount: 40,
          targetStopDuration: 1.2,
        },
      ],
    },
  },
];

export async function loadParticlePresets(
  url = `${RuntimePaths.dataBase}/vfx/particles.json`,
): Promise<ParticlePresetEntry[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [...BUILTIN_PRESETS];
    const json = (await res.json()) as { presets?: ParticlePresetEntry[] };
    if (!json.presets?.length) return [...BUILTIN_PRESETS];
    return json.presets;
  } catch {
    return [...BUILTIN_PRESETS];
  }
}

export function getBuiltinParticlePresets(): ParticlePresetEntry[] {
  return BUILTIN_PRESETS.map((p) => ({
    ...p,
    effect: JSON.parse(JSON.stringify(p.effect)) as ParticleEffectEditable,
  }));
}

export function newBlankParticlePreset(): ParticlePresetEntry {
  const effect = defaultParticleEffect('New Effect');
  return {
    id: effect.id,
    label: effect.name,
    effect,
  };
}
