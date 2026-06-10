import {
  AbstractMesh,
  Scene,
  SceneLoader,
  TransformNode,
  type ISceneLoaderAsyncResult,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { disableMeshBackfaceCulling } from '../render/mesh-material-utils';

/** glTF empties used as engine / weapon anchors (must follow the ship root). */
function isAnchorEmptyName(name: string): boolean {
  return (
    name === 'engine' ||
    name.startsWith('engine_') ||
    name.startsWith('weapon_') ||
    name.startsWith('fire_')
  );
}

function attachAnchorEmptiesToRoot(result: ISceneLoaderAsyncResult, root: TransformNode): void {
  const transformNodes = (result.transformNodes ?? []) as TransformNode[];
  for (const node of transformNodes) {
    if (isAnchorEmptyName(node.name)) {
      node.parent = root;
    }
  }
}

export interface LodResult {
  root: TransformNode;
  meshes: AbstractMesh[];
  lodMeshes: AbstractMesh[][];
}

const LOD_DISTANCES = [80, 200];

export class LodShipLoader {
  private readonly warnedUrls = new Set<string>();

  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string
  ) {}

  async loadWithLod(
    id: string,
    lodPaths: string[],
    scale: number | [number, number, number]
  ): Promise<LodResult | null> {
    const lodMeshes: AbstractMesh[][] = [];
    const root = new TransformNode(`${id}_root`, this.scene);
    let anyLoaded = false;

    for (let i = 0; i < lodPaths.length; i++) {
      const url = `${this.baseUrl}/${lodPaths[i]}`;
      try {
        const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
        const meshes = result.meshes.filter((m) => m instanceof AbstractMesh) as AbstractMesh[];
        if (meshes.length === 0 && (result.transformNodes?.length ?? 0) === 0) {
          continue;
        }

        meshes.forEach((m) => {
          m.parent = root;
          m.setEnabled(i === 0);
        });

        if (i === 0) {
          attachAnchorEmptiesToRoot(result, root);
        }

        lodMeshes.push(meshes);
        anyLoaded = true;
      } catch {
        if (!this.warnedUrls.has(url)) {
          this.warnedUrls.add(url);
          console.warn(`[LOD] failed to load ${url}`);
        }
      }
    }

    if (!anyLoaded) {
      root.dispose();
      return null;
    }

    const sx = Array.isArray(scale) ? scale[0] : scale;
    const sy = Array.isArray(scale) ? (scale[1] ?? scale[0]) : scale;
    const sz = Array.isArray(scale) ? (scale[2] ?? scale[0]) : scale;
    root.scaling.set(sx, sy, sz);

    const allMeshes = lodMeshes.flat();
    disableMeshBackfaceCulling(allMeshes);
    return { root, meshes: allMeshes, lodMeshes };
  }

  /** Instant LOD switch by camera distance. */
  updateLod(lodMeshes: AbstractMesh[][], cameraDistance: number): void {
    if (lodMeshes.length === 0) return;
    let active = lodMeshes.length - 1;
    for (let i = 0; i < LOD_DISTANCES.length && i < lodMeshes.length - 1; i++) {
      if (cameraDistance < LOD_DISTANCES[i]) {
        active = i;
        break;
      }
    }
    lodMeshes.forEach((group, idx) => {
      group.forEach((m) => m.setEnabled(idx === active));
    });
  }
}
