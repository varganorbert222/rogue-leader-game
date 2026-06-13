import { Vector3, type AbstractMesh, type Scene, type TransformNode } from '@babylonjs/core';

/** World-space distance (meters) from the active camera to the entity bounds center. */
export function computeCameraDistanceMeters(
  scene: Scene,
  root: TransformNode,
  boundsMeshes?: readonly AbstractMesh[],
): number {
  const camera = scene.activeCamera;
  if (!camera) return 0;

  const meshes =
    boundsMeshes && boundsMeshes.length > 0
      ? boundsMeshes
      : (root.getChildMeshes(false) as AbstractMesh[]);

  if (meshes.length === 0) {
    return Vector3.Distance(camera.globalPosition, root.getAbsolutePosition());
  }

  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);

  for (const mesh of meshes) {
    if (mesh.isDisposed()) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, box.minimumWorld);
    max = Vector3.Maximize(max, box.maximumWorld);
  }

  const center = min.add(max).scale(0.5);
  return Vector3.Distance(camera.globalPosition, center);
}
