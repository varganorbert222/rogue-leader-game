import {
  Color3,
  MeshBuilder,
  Vector3,
  type LinesMesh,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';

const ORIGIN_CROSS_COLOR = new Color3(0.55, 0.58, 0.62);

function createAxisLine(
  scene: Scene,
  name: string,
  direction: Vector3,
  length: number,
  parent: TransformNode,
): LinesMesh {
  const half = length * 0.5;
  const line = MeshBuilder.CreateLines(
    name,
    {
      points: [direction.scale(-half), direction.scale(half)],
    },
    scene,
  );
  line.color = ORIGIN_CROSS_COLOR;
  line.isPickable = false;
  line.parent = parent;
  return line;
}

/** Small muted local origin cross — no emissive glow. */
export function createLocalOriginCross(
  scene: Scene,
  parent: TransformNode,
  armLength = 0.06,
): LinesMesh[] {
  return [
    createAxisLine(scene, 'pfx_origin_x', Vector3.Right(), armLength, parent),
    createAxisLine(scene, 'pfx_origin_y', Vector3.Up(), armLength, parent),
    createAxisLine(scene, 'pfx_origin_z', Vector3.Forward(), armLength, parent),
  ];
}

export function disposeLineMeshes(meshes: LinesMesh[]): void {
  for (const mesh of meshes) {
    mesh.dispose();
  }
}
