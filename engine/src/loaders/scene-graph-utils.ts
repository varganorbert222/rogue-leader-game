import { Mesh, TransformNode, type AbstractMesh } from '@babylonjs/core';
import { normalizeAnchorNodeName } from './ship-anchor-detector';

/** Normalized mesh name for clone / LOD remapping lookups. */
export function meshLookupKey(name: string): string {
  return normalizeAnchorNodeName(name).toLowerCase();
}

/** Last path segment of a Babylon hierarchical mesh name (e.g. `.collider_wing`). */
export function meshLookupLeafKey(name: string): string {
  const normalized = meshLookupKey(name);
  return normalized.split('.').pop() ?? normalized;
}

/** Depth-first walk of transform + mesh nodes under root. */
export function walkSceneNodes(
  root: TransformNode,
  visit: (node: TransformNode | AbstractMesh) => void,
): void {
  const stack: TransformNode[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of current.getChildren()) {
      if (child instanceof Mesh) {
        visit(child);
        stack.push(child);
      } else if (child instanceof TransformNode) {
        visit(child);
        stack.push(child);
      }
    }
  }
}

/** Every mesh under transform-node parents (getChildMeshes misses nested transforms). */
export function collectDescendantMeshes(root: TransformNode): AbstractMesh[] {
  const meshes: AbstractMesh[] = [];
  walkSceneNodes(root, (node) => {
    if (node instanceof Mesh) {
      meshes.push(node);
    }
  });
  return meshes;
}

/** Map normalized mesh names to meshes (first wins). */
export function buildMeshLookupMap(
  meshes: readonly AbstractMesh[],
): Map<string, AbstractMesh> {
  const byKey = new Map<string, AbstractMesh>();
  for (const mesh of meshes) {
    const key = meshLookupKey(mesh.name);
    if (!byKey.has(key)) {
      byKey.set(key, mesh);
    }
  }
  return byKey;
}

/** Pair LOD0 meshes to counterparts in another group by normalized name. */
export function mapMeshesByLookupKey(
  sourceMeshes: readonly AbstractMesh[],
  targetMeshes: readonly AbstractMesh[],
): Map<AbstractMesh, AbstractMesh> {
  const byKey = buildMeshLookupMap(targetMeshes);
  const pairs = new Map<AbstractMesh, AbstractMesh>();
  for (const source of sourceMeshes) {
    const match = byKey.get(meshLookupKey(source.name));
    if (match) {
      pairs.set(source, match);
    }
  }
  return pairs;
}
