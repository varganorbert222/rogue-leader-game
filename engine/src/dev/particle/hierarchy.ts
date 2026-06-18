import type { HierarchyNode } from '../hierarchy-types';

import type { ParticleEffectEditable, ParticleEffectTreeNode } from './types';



function treeNodeToHierarchy(node: ParticleEffectTreeNode): HierarchyNode {

  if (node.kind === 'group') {

    return {

      id: node.id,

      label: node.name,

      kind: 'effectGroup',

      children: node.children.map(treeNodeToHierarchy),

    };

  }



  const slot = node.slot!;

  return {

    id: node.id,

    label: slot.name,

    kind: 'particleSystem',

    particlePresetRef: slot.presetRef ? { ...slot.presetRef } : undefined,

    children: node.children.map(treeNodeToHierarchy),

  };

}



export function buildParticleEffectHierarchy(effect: ParticleEffectEditable): HierarchyNode[] {

  return [

    {

      id: effect.id,

      label: effect.name,

      kind: 'effectRoot',

      children: effect.tree.map(treeNodeToHierarchy),

    },

  ];

}

