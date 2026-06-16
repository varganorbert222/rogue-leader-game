import type { HierarchyNode } from '../hierarchy-types';
import type { ParticleEffectEditable } from './types';

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
