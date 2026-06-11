import { Vector3 } from '@babylonjs/core';
import type { NavPathDefinition } from './nav-types';

export interface PathFollowDebugInfo {
  waypointIndex: number;
  target: Vector3;
  pathId?: string;
}

/** Advances along a shared waypoint path. */
export class PathFollower {
  private waypointIndex = 0;

  constructor(
    private readonly path: NavPathDefinition,
    private readonly arriveRadius: number,
    readonly pathId?: string
  ) {}

  getWaypointCount(): number {
    return this.path.points.length;
  }

  getWaypointWorld(index: number): Vector3 {
    const pt = this.path.points[index];
    return Vector3.FromArray(pt);
  }

  getSteeringTarget(position: Vector3): Vector3 {
    if (this.path.points.length === 0) {
      return position.clone();
    }
    this.advanceIfArrived(position);
    return this.getWaypointWorld(this.waypointIndex);
  }

  getDebugInfo(position: Vector3): PathFollowDebugInfo {
    return {
      waypointIndex: this.waypointIndex,
      target: this.getSteeringTarget(position),
      pathId: this.pathId,
    };
  }

  getPolyline(): Vector3[] {
    return this.path.points.map((pt) => Vector3.FromArray(pt));
  }

  private advanceIfArrived(position: Vector3): void {
    if (this.path.points.length === 0) return;

    const target = this.getWaypointWorld(this.waypointIndex);
    if (Vector3.Distance(position, target) > this.arriveRadius) {
      return;
    }

    const next = this.waypointIndex + 1;
    if (next < this.path.points.length) {
      this.waypointIndex = next;
      return;
    }

    if (this.path.loop !== false) {
      this.waypointIndex = 0;
    }
  }
}
