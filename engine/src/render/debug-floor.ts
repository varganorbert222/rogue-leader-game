import { Color3, MeshBuilder, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';

export interface DebugFloorOptions {
  center?: Vector3;
  /** Half-width of the square grid along X and Z. */
  extent?: number;
  /** Distance between grid lines. */
  step?: number;
  y?: number;
  /** Optional play-area boundary circle (wireframe). */
  boundaryRadius?: number;
}

/** XZ line grid for spatial orientation during development. */
export class DebugFloor {
  private readonly meshes: LinesMesh[] = [];

  constructor(scene: Scene, options: DebugFloorOptions = {}) {
    const y = options.y ?? 0;
    const extent = options.extent ?? 1000;
    const step = options.step ?? 50;
    const center = options.center ?? Vector3.Zero();

    const lines: Vector3[][] = [];

    for (let x = -extent; x <= extent; x += step) {
      lines.push([
        new Vector3(center.x + x, y, center.z - extent),
        new Vector3(center.x + x, y, center.z + extent),
      ]);
    }
    for (let z = -extent; z <= extent; z += step) {
      lines.push([
        new Vector3(center.x - extent, y, center.z + z),
        new Vector3(center.x + extent, y, center.z + z),
      ]);
    }

    const grid = MeshBuilder.CreateLineSystem('debugFloorGrid', { lines }, scene);
    grid.color = new Color3(0.28, 0.58, 0.88);
    grid.isPickable = false;
    this.meshes.push(grid);

    const axis = MeshBuilder.CreateLineSystem(
      'debugFloorAxis',
      {
        lines: [
          [
            new Vector3(center.x, y, center.z),
            new Vector3(center.x + 80, y, center.z),
          ],
          [
            new Vector3(center.x, y, center.z),
            new Vector3(center.x, y, center.z + 80),
          ],
        ],
      },
      scene
    );
    axis.color = new Color3(0.95, 0.45, 0.35);
    axis.isPickable = false;
    this.meshes.push(axis);

    if (options.boundaryRadius && options.boundaryRadius > 0) {
      const boundary = this.createCircle(
        center.x,
        y,
        center.z,
        options.boundaryRadius,
        72,
        scene
      );
      boundary.color = new Color3(0.95, 0.55, 0.2);
      boundary.isPickable = false;
      this.meshes.push(boundary);
    }
  }

  setEnabled(enabled: boolean): void {
    for (const mesh of this.meshes) {
      mesh.setEnabled(enabled);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes.length = 0;
  }

  private createCircle(
    cx: number,
    y: number,
    cz: number,
    radius: number,
    segments: number,
    scene: Scene
  ): LinesMesh {
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new Vector3(cx + Math.cos(t) * radius, y, cz + Math.sin(t) * radius));
    }
    return MeshBuilder.CreateLines('debugPlayBoundary', { points }, scene);
  }
}
