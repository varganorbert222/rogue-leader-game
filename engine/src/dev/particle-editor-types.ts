import type { HierarchyNode } from './hierarchy-types';

export type ParticleBlendMode = 'add' | 'standard' | 'multiply' | 'oneone';
export type ParticleTextureKind = 'flare' | 'none';
export type ParticlePlayMode = 'loop' | 'burst';

export interface Vec3Editable {
  x: number;
  y: number;
  z: number;
}

export interface Color4Editable {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Editable fields supported by BabylonJS `ParticleSystem` in this project. */
export interface ParticleSystemEditable {
  id: string;
  name: string;
  capacity: number;
  texture: ParticleTextureKind;
  playMode: ParticlePlayMode;
  minEmitBox: Vec3Editable;
  maxEmitBox: Vec3Editable;
  color1: Color4Editable;
  color2: Color4Editable;
  colorDead: Color4Editable;
  minSize: number;
  maxSize: number;
  minLifeTime: number;
  maxLifeTime: number;
  emitRate: number;
  manualEmitCount: number;
  targetStopDuration: number;
  blendMode: ParticleBlendMode;
  direction1: Vec3Editable;
  direction2: Vec3Editable;
  gravity: Vec3Editable;
  minAngularSpeed: number;
  maxAngularSpeed: number;
  minEmitPower: number;
  maxEmitPower: number;
  updateSpeed: number;
  startDelay: number;
  disposeOnStop: boolean;
}

export interface ParticleEffectEditable {
  id: string;
  name: string;
  systems: ParticleSystemEditable[];
}

export interface ParticlePresetEntry {
  id: string;
  label: string;
  effect: ParticleEffectEditable;
}

export function vec3(x = 0, y = 0, z = 0): Vec3Editable {
  return { x, y, z };
}

export function color4(r = 1, g = 1, b = 1, a = 1): Color4Editable {
  return { r, g, b, a };
}

let particleIdCounter = 0;

export function nextParticleSystemId(): string {
  particleIdCounter += 1;
  return `ps_${particleIdCounter}`;
}

export function defaultParticleSystem(name = 'Particle System'): ParticleSystemEditable {
  return {
    id: nextParticleSystemId(),
    name,
    capacity: 120,
    texture: 'flare',
    playMode: 'loop',
    minEmitBox: vec3(),
    maxEmitBox: vec3(),
    color1: color4(1, 0.6, 0.1, 1),
    color2: color4(1, 0.2, 0, 0.5),
    colorDead: color4(0, 0, 0, 0),
    minSize: 0.3,
    maxSize: 1.2,
    minLifeTime: 0.2,
    maxLifeTime: 0.6,
    emitRate: 200,
    manualEmitCount: 60,
    targetStopDuration: 0,
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
  };
}

export function defaultParticleEffect(name = 'New Effect'): ParticleEffectEditable {
  return {
    id: `effect_${Date.now()}`,
    name,
    systems: [defaultParticleSystem('Main')],
  };
}

export function buildParticleEffectHierarchy(effect: ParticleEffectEditable): HierarchyNode[] {
  return [
    {
      id: effect.id,
      label: effect.name,
      kind: 'effectRoot',
      isGenerated: true,
      children: effect.systems.map((system) => ({
        id: system.id,
        label: system.name,
        kind: 'particleSystem',
        isGenerated: true,
        children: [],
      })),
    },
  ];
}

export function cloneParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  return JSON.parse(JSON.stringify(effect)) as ParticleEffectEditable;
}
