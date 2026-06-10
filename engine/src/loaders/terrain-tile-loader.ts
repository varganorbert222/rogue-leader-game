import type { Scene } from '@babylonjs/core';

/**
 * Part B: terrain_x0_y0.glb tile loading with frustum + distance culling.
 * MVP: interface stub for Mission 2/3.
 */
export interface TerrainTileManifest {
  tileSize: number;
  tiles: string[];
}

export class TerrainTileLoader {
  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string
  ) {}

  async loadManifest(_url: string): Promise<TerrainTileManifest | null> {
    // TODO Part B: load assets/terrain/manifest.json
    return null;
  }

  updateVisibleTiles(_cameraPosition: { x: number; y: number; z: number }): void {
    // stub
  }

  dispose(): void {
    // stub
  }
}
