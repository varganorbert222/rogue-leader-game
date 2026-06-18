import { normalizeParticleSystemSlot } from './refs';
import {
  cloneEffectTree,
  normalizeEffectTree,
  syncEffectSystemsFromTree,
} from './tree';
import type { ParticleEffectEditable } from './types';

export function normalizeParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  const tree = normalizeEffectTree(effect);
  const normalized: ParticleEffectEditable = {
    ...effect,
    tree,
    systems: [],
  };
  syncEffectSystemsFromTree(normalized);
  return normalized;
}

export function cloneParticleEffect(effect: ParticleEffectEditable): ParticleEffectEditable {
  const cloned = JSON.parse(JSON.stringify(effect)) as ParticleEffectEditable;
  cloned.tree = cloneEffectTree(cloned.tree ?? []);
  return normalizeParticleEffect(cloned);
}
