import type { AbstractMesh } from '@babylonjs/core';

export interface ColliderComponent {
  radius: number;
  meshes: readonly AbstractMesh[];
}
