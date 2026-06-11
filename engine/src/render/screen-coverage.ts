import {
  Matrix,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';

/** Screen-height coverage % of an entity's world bounds (Unity LOD Group style). */
export function computeScreenCoveragePercent(
  scene: Scene,
  root: TransformNode,
  meshes?: AbstractMesh[]
): number {
  const camera = scene.activeCamera;
  if (!camera) return 100;

  const boundsMeshes =
    meshes && meshes.length > 0
      ? meshes
      : (root.getChildMeshes(false) as AbstractMesh[]);

  if (boundsMeshes.length === 0) {
    return 0;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  const transformMatrix = scene.getTransformMatrix();
  const engine = scene.getEngine();
  const renderW = engine.getRenderWidth();
  const renderH = engine.getRenderHeight();
  const viewport = camera.viewport.toGlobal(renderW, renderH);

  for (const mesh of boundsMeshes) {
    const bi = mesh.getBoundingInfo();
    const box = bi.boundingBox;
    const corners = [
      new Vector3(box.minimumWorld.x, box.minimumWorld.y, box.minimumWorld.z),
      new Vector3(box.maximumWorld.x, box.minimumWorld.y, box.minimumWorld.z),
      new Vector3(box.minimumWorld.x, box.maximumWorld.y, box.minimumWorld.z),
      new Vector3(box.maximumWorld.x, box.maximumWorld.y, box.minimumWorld.z),
      new Vector3(box.minimumWorld.x, box.minimumWorld.y, box.maximumWorld.z),
      new Vector3(box.maximumWorld.x, box.minimumWorld.y, box.maximumWorld.z),
      new Vector3(box.minimumWorld.x, box.maximumWorld.y, box.maximumWorld.z),
      new Vector3(box.maximumWorld.x, box.maximumWorld.y, box.maximumWorld.z),
    ];

    for (const corner of corners) {
      const projected = Vector3.Project(corner, Matrix.Identity(), transformMatrix, viewport);
      if (projected.z < 0 || projected.z > 1) continue;
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    }
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return fallbackAngularCoverage(camera, root, boundsMeshes);
  }

  const heightPx = Math.max(0, maxY - minY);
  return (heightPx / renderH) * 100;
}

function fallbackAngularCoverage(
  camera: Camera,
  root: TransformNode,
  meshes: AbstractMesh[]
): number {
  let maxDim = 0;
  const center = root.getAbsolutePosition();

  for (const mesh of meshes) {
    const extend = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
    maxDim = Math.max(maxDim, extend.x, extend.y, extend.z) * 2;
  }

  if (maxDim <= 0) return 0;

  const distance = Vector3.Distance(camera.globalPosition, center);
  if (distance < 1e-4) return 100;

  const fov = (camera as Camera & { fov?: number }).fov ?? Math.PI / 4;
  const angularHeight = 2 * Math.atan(maxDim * 0.5 / distance);
  return Math.min(100, (angularHeight / fov) * 100);
}
