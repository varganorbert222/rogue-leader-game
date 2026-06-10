import {
  Color3,
  MeshBuilder,
  Vector3,
  type LinesMesh,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';

const AXIS_COLORS = {
  x: new Color3(1, 0.25, 0.25),
  y: new Color3(0.3, 1, 0.35),
  z: new Color3(0.35, 0.6, 1),
} as const;

function createSingleAxis(
  scene: Scene,
  name: string,
  direction: Vector3,
  length: number,
  color: Color3,
  origin: Vector3,
  parent?: TransformNode
): LinesMesh {
  const end = origin.add(direction.scale(length));
  const line = MeshBuilder.CreateLines(
    name,
    { points: [origin.clone(), end] },
    scene
  );
  line.color = color;
  line.isPickable = false;
  if (parent) {
    line.parent = parent;
  }
  return line;
}

export interface DebugAxesOptions {
  /** Axis line length in world/local units. */
  length?: number;
  /** World-space origin for fixed axes. */
  origin?: Vector3;
}

/** RGB = XYZ debug axis gizmo (Babylon LH: +X right, +Y up, +Z forward). */
export class DebugAxes {
  private readonly meshes: LinesMesh[] = [];

  /** World axes anchored at a fixed point (default origin). */
  static world(scene: Scene, options: DebugAxesOptions = {}): DebugAxes {
    const axes = new DebugAxes();
    const length = options.length ?? 50;
    const origin = options.origin ?? Vector3.Zero();
    axes.meshes.push(
      createSingleAxis(scene, 'debugWorldAxisX', Vector3.Right(), length, AXIS_COLORS.x, origin),
      createSingleAxis(scene, 'debugWorldAxisY', Vector3.Up(), length, AXIS_COLORS.y, origin),
      createSingleAxis(
        scene,
        'debugWorldAxisZ',
        Vector3.Forward(),
        length,
        AXIS_COLORS.z,
        origin
      )
    );
    return axes;
  }

  /** Local ship axes parented to the craft root (+Z = nose). */
  static local(scene: Scene, parent: TransformNode, length = 12): DebugAxes {
    const axes = new DebugAxes();
    const origin = Vector3.Zero();
    axes.meshes.push(
      createSingleAxis(
        scene,
        'debugShipAxisX',
        Vector3.Right(),
        length,
        AXIS_COLORS.x,
        origin,
        parent
      ),
      createSingleAxis(
        scene,
        'debugShipAxisY',
        Vector3.Up(),
        length,
        AXIS_COLORS.y,
        origin,
        parent
      ),
      createSingleAxis(
        scene,
        'debugShipAxisZ',
        Vector3.Forward(),
        length,
        AXIS_COLORS.z,
        origin,
        parent
      )
    );
    return axes;
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes.length = 0;
  }
}
