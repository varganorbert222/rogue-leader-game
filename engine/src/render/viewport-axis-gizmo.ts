import { Vector3, type Camera } from '@babylonjs/core';

const AXIS_COLORS = {
  x: '#e85d5d',
  y: '#5dd67a',
  z: '#6ea8ff',
} as const;

const WORLD_AXES = {
  x: Vector3.Right(),
  y: Vector3.Up(),
  z: Vector3.Forward(),
} as const;

type AxisKey = keyof typeof WORLD_AXES;

export interface ViewportAxisGizmoLine {
  label: string;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  color: string;
}

/** World XYZ projected to 2D widget space (zoom-independent). */
export function computeViewportAxisGizmoLines(
  camera: Camera,
  size = 80,
): ViewportAxisGizmoLine[] {
  camera.getScene()?.updateTransformMatrix(true);
  const view = camera.getViewMatrix(true);
  const len = size * 0.38;
  const cx = size * 0.5;

  const axes: AxisKey[] = ['x', 'y', 'z'];
  return [...axes]
    .map((axis) => {
      const v = Vector3.TransformNormal(WORLD_AXES[axis], view);
      const x2 = cx + v.x * len;
      const y2 = cx + -v.y * len;
      return {
        label: axis.toUpperCase(),
        x2,
        y2,
        labelX: x2 + 3,
        labelY: y2 + 4,
        color: AXIS_COLORS[axis],
        depth: v.z,
      };
    })
    .sort((a, b) => a.depth - b.depth)
    .map(({ label, x2, y2, labelX, labelY, color }) => ({
      label,
      x2,
      y2,
      labelX,
      labelY,
      color,
    }));
}
