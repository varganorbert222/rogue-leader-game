import {
  AbstractMesh,
  TransformNode,
  type ISceneLoaderAsyncResult,
  type Node,
} from '@babylonjs/core';

/**
 * Parent the loaded glTF scene under `parent` without flattening meshes or anchor empties.
 * Preserves Blender export hierarchy so engine / weapon reference points keep their offsets.
 */
export function attachGltfImportToParent(
  result: ISceneLoaderAsyncResult,
  parent: TransformNode
): AbstractMesh[] {
  const meshes = result.meshes.filter((m) => m instanceof AbstractMesh) as AbstractMesh[];
  const transformNodes = (result.transformNodes ?? []) as TransformNode[];
  const imported = new Set<Node>([...meshes, ...transformNodes]);

  const roots: Node[] = [];
  for (const node of [...transformNodes, ...meshes]) {
    const p = node.parent;
    if (!p || !imported.has(p)) {
      roots.push(node);
    }
  }

  const uniqueRoots = [...new Set(roots)];
  for (const node of uniqueRoots) {
    node.parent = parent;
  }

  return meshes;
}
