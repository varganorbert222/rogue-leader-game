import { DevConfigPaths } from '../dev-config-paths';
import { RuntimePaths } from '../../runtime-paths';
import { color4, vec3 } from '../shared/editable-primitives';
import { defaultParticleEffect, defaultParticleShape } from './defaults';
import { normalizeParticleEffect } from './normalize';
import { normalizeParticleSystem } from './system-normalize';
import type { ParticleEffectEditable, ParticlePresetEntry, ParticleSystemEditable } from './types';

function builtinEffect(
  id: string,
  name: string,
  systems: ParticleSystemEditable[],
): ParticleEffectEditable {
  return normalizeParticleEffect({
    id,
    name,
    tree: [],
    systems: systems.map((system) => ({
      id: system.id,
      name: system.name,
      config: system,
    })),
  });
}

function presetSystem(
  id: string,
  name: string,
  overrides: Partial<ParticleSystemEditable>,
): ParticleSystemEditable {
  return normalizeParticleSystem({ ...overrides, id, name });
}

const EXPLOSION_SYSTEM = presetSystem('ps_explosion', 'Burst', {
  capacity: 120,
  emissionMode: 'burst',
  burstCount: 120,
  duration: 0,
  looping: false,
  minStartSpeedMps: 6,
  maxStartSpeedMps: 14,
  minSize: 0.3,
  maxSize: 1.2,
  minLifeTime: 0.2,
  maxLifeTime: 0.6,
  emitRate: 800,
  blendMode: 'add',
  shape: {
    ...defaultParticleShape('point'),
    direction1: vec3(-1, -1, -1),
    direction2: vec3(1, 1, 1),
  },
  color1: color4(1, 0.6, 0.1, 1),
  color2: color4(1, 0.2, 0, 0.5),
  colorDead: color4(0, 0, 0, 0),
});

const DEBRIS_SMOKE_SYSTEM = presetSystem('ps_debris_smoke', 'Smoke', {
  capacity: 60,
  emissionMode: 'rate',
  duration: 0,
  looping: true,
  minStartSpeedMps: 0.5,
  maxStartSpeedMps: 2,
  minSize: 0.25,
  maxSize: 1.1,
  minLifeTime: 0.6,
  maxLifeTime: 1.8,
  emitRate: 35,
  burstCount: 0,
  blendMode: 'alpha',
  shape: {
    ...defaultParticleShape('box'),
    boxMin: vec3(-0.15, -0.15, -0.15),
    boxMax: vec3(0.15, 0.15, 0.15),
    direction1: vec3(-0.25, 0.4, -0.25),
    direction2: vec3(0.25, 1.2, 0.25),
  },
  color1: color4(0.35, 0.35, 0.35, 0.55),
  color2: color4(0.15, 0.15, 0.15, 0),
  colorDead: color4(0, 0, 0, 0),
  gravity: vec3(0, 0.4, 0),
});

const BUILTIN_PRESETS: ParticlePresetEntry[] = [
  {
    id: 'explosion',
    label: 'Explosion burst',
    effect: builtinEffect('preset_explosion', 'Explosion', [EXPLOSION_SYSTEM]),
  },
  {
    id: 'hit_spark',
    label: 'Hit spark',
    effect: builtinEffect('preset_hit_spark', 'Hit Spark', [
      presetSystem('ps_hit_spark', 'Spark', {
        capacity: 30,
        emissionMode: 'burst',
        burstCount: 30,
        duration: 0,
        looping: false,
        minStartSpeedMps: 4,
        maxStartSpeedMps: 10,
        minSize: 0.1,
        maxSize: 0.4,
        minLifeTime: 0.05,
        maxLifeTime: 0.2,
        emitRate: 200,
        blendMode: 'add',
        shape: defaultParticleShape('point'),
        color1: color4(0.5, 0.8, 1, 1),
        color2: color4(1, 1, 1, 0),
        colorDead: color4(0, 0, 0, 0),
      }),
    ]),
  },
  {
    id: 'debris_smoke',
    label: 'Debris smoke',
    effect: builtinEffect('preset_debris_smoke', 'Debris Smoke', [DEBRIS_SMOKE_SYSTEM]),
  },
  {
    id: 'debris_fire',
    label: 'Debris fire',
    effect: builtinEffect('preset_debris_fire', 'Debris Fire', [
      presetSystem('ps_debris_fire', 'Fire', {
        capacity: 80,
        emissionMode: 'rate',
        duration: 0,
        looping: true,
        minStartSpeedMps: 0.8,
        maxStartSpeedMps: 2.5,
        minSize: 0.15,
        maxSize: 0.75,
        minLifeTime: 0.15,
        maxLifeTime: 0.55,
        emitRate: 90,
        burstCount: 0,
        blendMode: 'add',
        shape: {
          ...defaultParticleShape('box'),
          boxMin: vec3(-0.1, -0.1, -0.1),
          boxMax: vec3(0.1, 0.1, 0.1),
          direction1: vec3(-0.35, -0.15, -0.35),
          direction2: vec3(0.35, 0.45, 0.35),
        },
        color1: color4(1, 0.75, 0.15, 0.95),
        color2: color4(0.9, 0.15, 0, 0),
        colorDead: color4(0, 0, 0, 0),
        gravity: vec3(0, 0.15, 0),
      }),
    ]),
  },
  {
    id: 'explosion_combo',
    label: 'Explosion + smoke (multi-system)',
    effect: builtinEffect('preset_explosion_combo', 'Explosion Combo', [
      presetSystem('ps_combo_burst', 'Burst', { ...EXPLOSION_SYSTEM, id: 'ps_combo_burst', name: 'Burst' }),
      presetSystem('ps_combo_smoke', 'Smoke trail', {
        ...DEBRIS_SMOKE_SYSTEM,
        id: 'ps_combo_smoke',
        name: 'Smoke trail',
        emissionMode: 'burst',
        burstCount: 40,
        looping: false,
      }),
    ]),
  },
];
export async function loadParticlePresets(): Promise<ParticlePresetEntry[]> {
  for (const url of [RuntimePaths.particlePresets, DevConfigPaths.particleEditor.presets]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as { presets?: ParticlePresetEntry[] };
      if (!json.presets?.length) continue;
      return json.presets.map((preset) => ({
        ...preset,
        effect: normalizeParticleEffect(preset.effect),
      }));
    } catch {
      // try next source
    }
  }
  return getBuiltinParticlePresets();
}

export function getBuiltinParticlePresets(): ParticlePresetEntry[] {
  return BUILTIN_PRESETS.map((preset) => ({
    ...preset,
    effect: normalizeParticleEffect(preset.effect),
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
