import type { ParticleSubEmitterLink } from './types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function normalizeSubEmitters(
  links?: readonly Partial<ParticleSubEmitterLink>[],
): ParticleSubEmitterLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => ({
      targetSystemId: typeof link.targetSystemId === 'string' ? link.targetSystemId : '',
      trigger: link.trigger === 'birth' ? 'birth' as const : 'death' as const,
      probability: clamp01(typeof link.probability === 'number' ? link.probability : 1),
      inheritVelocity: !!link.inheritVelocity,
    }))
    .filter((link) => link.targetSystemId.length > 0);
}
