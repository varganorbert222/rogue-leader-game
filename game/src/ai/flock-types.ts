import type { Vector3 } from '@babylonjs/core';

export interface FlockMate {
  id: string;
  position: Vector3;
  velocity: Vector3;
  radius: number;
}

export interface EnemyAIContext {
  playerPos: Vector3;
  flockMates: FlockMate[];
  flockCenter: Vector3;
}
