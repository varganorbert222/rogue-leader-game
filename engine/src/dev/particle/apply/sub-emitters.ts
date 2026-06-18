import { SubEmitter, SubEmitterType, type ParticleSystem } from '@babylonjs/core';
import type { ParticleSubEmitterLink } from '../types';

/**
 * Wire Babylon sub-emitters on a parent CPU particle system.
 * `birth` maps to ATTACHED (spawn with particle); `death` maps to END.
 */
export function applySubEmittersToParticleSystem(
  parent: ParticleSystem,
  links: readonly ParticleSubEmitterLink[],
  resolveTemplate: (targetSystemId: string) => ParticleSystem | null,
): void {
  if (!links.length) {
    parent.subEmitters = [];
    return;
  }

  const emitters: SubEmitter[] = [];
  for (const link of links) {
    const template = resolveTemplate(link.targetSystemId);
    if (!template) continue;

    const sub = new SubEmitter(template);
    sub.type =
      link.trigger === 'birth' ? SubEmitterType.ATTACHED : SubEmitterType.END;
    sub.inheritDirection = link.inheritVelocity;
    sub.inheritedVelocityAmount = link.inheritVelocity ? 0.65 : 0;
    emitters.push(sub);
  }

  parent.subEmitters = emitters;
}

export function collectSubEmitterTargetIds(
  systems: readonly { subEmitters?: readonly ParticleSubEmitterLink[] }[],
): Set<string> {
  const ids = new Set<string>();
  for (const system of systems) {
    for (const link of system.subEmitters ?? []) {
      if (link.targetSystemId) ids.add(link.targetSystemId);
    }
  }
  return ids;
}
