import {
  AbstractMesh,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { ShipManifestEntry, PropManifestEntry } from './asset-manifest';
import { warnMissingOnce } from './asset-manifest';
import { detectFirePoints } from './firepoint-detector';
import { LodShipLoader } from './lod-ship-loader';
import { attachVisualPivot } from './visual-pivot';

export interface LoadedEntity {
  root: TransformNode;
  /** Child of root — cosmetic banking; physics stay on root. */
  visualRoot: TransformNode;
  meshes: AbstractMesh[];
  lodMeshes: AbstractMesh[][];
  colliderRadius: number;
  firePoints: ReturnType<typeof detectFirePoints>;
  isPlaceholder: boolean;
}

export class GltfShipLoader {
  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string,
    private readonly lodLoader: LodShipLoader
  ) {}

  async loadShip(id: string, entry: ShipManifestEntry): Promise<LoadedEntity> {
    const result = await this.lodLoader.loadWithLod(id, entry.lod, entry.scale);
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      return {
        root: result.root,
        visualRoot,
        meshes: result.meshes,
        lodMeshes: result.lodMeshes,
        colliderRadius: entry.colliderRadius,
        firePoints: detectFirePoints(result.root),
        isPlaceholder: false,
      };
    }

    warnMissingOnce(`ship:${id}`);
    return this.createPlaceholderShip(id, entry.colliderRadius);
  }

  async loadProp(id: string, entry: PropManifestEntry): Promise<LoadedEntity> {
    const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
    const result = await this.lodLoader.loadWithLod(id, entry.lod, scale);
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      return {
        root: result.root,
        visualRoot,
        meshes: result.meshes,
        lodMeshes: result.lodMeshes,
        colliderRadius: entry.colliderRadius,
        firePoints: { fires: [], engines: [] },
        isPlaceholder: false,
      };
    }

    warnMissingOnce(`prop:${id}`);
    return this.createPlaceholderMeteor(entry.colliderRadius);
  }

  private createPlaceholderShip(id: string, radius: number): LoadedEntity {
    const root = new TransformNode(`placeholder_${id}`, this.scene);
    const visualRoot = new TransformNode(`${id}_visual`, this.scene);
    visualRoot.parent = root;
    const body = MeshBuilder.CreateBox(`${id}_body`, { width: 2, height: 0.6, depth: 3 }, this.scene);
    body.parent = visualRoot;
    const nose = MeshBuilder.CreateCylinder(`${id}_nose`, { diameterTop: 0, diameterBottom: 0.8, height: 1.2 }, this.scene);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -2;
    nose.parent = visualRoot;
    return {
      root,
      visualRoot,
      meshes: [body, nose],
      lodMeshes: [[body, nose]],
      colliderRadius: radius,
      firePoints: detectFirePoints(root),
      isPlaceholder: true,
    };
  }

  private createPlaceholderMeteor(radius: number): LoadedEntity {
    const root = new TransformNode('placeholder_meteor', this.scene);
    const visualRoot = attachVisualPivot(root, this.scene);
    const mesh = MeshBuilder.CreateIcoSphere('meteor', { radius: 1, subdivisions: 2 }, this.scene);
    mesh.parent = visualRoot;
    return {
      root,
      visualRoot,
      meshes: [mesh],
      lodMeshes: [[mesh]],
      colliderRadius: radius,
      firePoints: { fires: [], engines: [] },
      isPlaceholder: true,
    };
  }
}
