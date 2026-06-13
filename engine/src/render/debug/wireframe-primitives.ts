import { Vector3 } from '@babylonjs/core';

/** Accumulates line segments for batched debug line overlays. */
export class LineSegmentCollector {
  readonly lines: Vector3[][] = [];

  clear(): void {
    this.lines.length = 0;
  }

  add(a: Vector3, b: Vector3): void {
    this.lines.push([a, b]);
  }
}
