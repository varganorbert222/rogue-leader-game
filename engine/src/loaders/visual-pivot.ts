import { TransformNode, type Scene } from '@babylonjs/core';

/** Reparents ship meshes under a child node for cosmetic roll/pitch offsets. */
export function attachVisualPivot(root: TransformNode, scene: Scene): TransformNode {
  const visual = new TransformNode(`${root.name}_visual`, scene);
  visual.parent = root;
  for (const child of [...root.getChildren()]) {
    if (child !== visual) {
      child.parent = visual;
    }
  }
  return visual;
}
