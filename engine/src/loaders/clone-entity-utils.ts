import { TransformNode, type AbstractMesh } from '@babylonjs/core';
import {
  collectDescendantMeshes,
  meshLookupKey,
} from './scene-graph-utils';

export { collectDescendantMeshes } from './scene-graph-utils';

/** Resolve the cosmetic visual pivot created by {@link attachVisualPivot}. */
export function findVisualRoot(root: TransformNode): TransformNode {
  return (
    (root.getChildTransformNodes(false).find((node) => node.name.endsWith('_visual')) as
      | TransformNode
      | undefined) ?? root
  );
}

function buildMeshLookup(clonedRoot: TransformNode): Map<string, AbstractMesh> {
  const byKey = new Map<string, AbstractMesh>();
  for (const mesh of collectDescendantMeshes(clonedRoot)) {
    byKey.set(meshLookupKey(mesh.name), mesh);
  }
  return byKey;
}

/** Map template mesh groups onto the matching meshes in a cloned hierarchy. */
export function remapMeshGroupByName(
  templateMeshes: readonly AbstractMesh[],
  templateRoot: TransformNode,
  clonedRoot: TransformNode,
): AbstractMesh[] {
  if (templateMeshes.length === 0) return [];

  const byKey = buildMeshLookup(clonedRoot);
  const templateOrder = collectDescendantMeshes(templateRoot);
  const cloneOrder = collectDescendantMeshes(clonedRoot);

  const remapped: AbstractMesh[] = [];
  for (const templateMesh of templateMeshes) {
    const byName = byKey.get(meshLookupKey(templateMesh.name));
    if (byName) {
      remapped.push(byName);
      continue;
    }

    const idx = templateOrder.indexOf(templateMesh);
    if (idx >= 0 && idx < cloneOrder.length) {
      remapped.push(cloneOrder[idx]);
    }
  }
  return remapped;
}

export function remapLodMeshGroups(
  templateGroups: AbstractMesh[][],
  templateRoot: TransformNode,
  clonedRoot: TransformNode,
): AbstractMesh[][] {
  return templateGroups.map((group) =>
    remapMeshGroupByName(group, templateRoot, clonedRoot),
  );
}

/** Deep-clone a loaded entity root even when the template hierarchy is hidden in the pool. */
export function cloneLoadedEntityRoot(
  templateRoot: TransformNode,
  instanceId: string,
): TransformNode {
  const wasEnabled = templateRoot.isEnabled();
  if (!wasEnabled) {
    templateRoot.setEnabled(true);
  }

  const root = templateRoot.clone(`${instanceId}_root`, null) as TransformNode;
  root.setEnabled(true);

  if (!wasEnabled) {
    templateRoot.setEnabled(false);
  }

  return root;
}
