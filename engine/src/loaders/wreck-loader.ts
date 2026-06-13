import {
  Mesh,
  Scene,
  SceneLoader,
  TransformNode,
  type AbstractMesh,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { ShipManifestEntry } from './asset-manifest';
import { warnMissingOnce } from './asset-manifest';
import { attachGltfImportToParent } from './gltf-import-utils';
import { applyModelAxisCorrection } from './ship-axis-convention';
import { disableMeshBackfaceCulling, applyMeshAlphaCutoff } from '../render/mesh-material-utils';
import { resolveWreckPath } from './wreck-path';

export interface WreckTemplate {
  root: TransformNode;
  /** Debris meshes used when the wreck is spawned (typically `*Piece*` nodes). */
  pieceMeshes: Mesh[];
}

/** Prefer numbered sub-meshes; skip combined hull when piece parts exist. */
export function filterDebrisPieceMeshes(meshes: readonly Mesh[]): Mesh[] {
  const pieces = meshes.filter((mesh) => /piece/i.test(mesh.name));
  return pieces.length > 0 ? pieces : [...meshes];
}

export class WreckLoader {
  private readonly cache = new Map<string, WreckTemplate>();

  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string
  ) {}

  getCached(shipId: string): WreckTemplate | undefined {
    return this.cache.get(shipId);
  }

  async loadWreck(shipId: string, entry: ShipManifestEntry): Promise<WreckTemplate | null> {
    const cached = this.cache.get(shipId);
    if (cached) return cached;

    const relativePath = resolveWreckPath(entry);
    if (!relativePath) return null;

    const url = `${this.baseUrl}/${relativePath}`;
    try {
      const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
      if (result.meshes.length === 0 && (result.transformNodes?.length ?? 0) === 0) {
        throw new Error('empty wreck');
      }

      const root = new TransformNode(`${shipId}_wreck_tpl`, this.scene);
      attachGltfImportToParent(result, root);

      const scale = entry.scale;
      const sx = Array.isArray(scale) ? scale[0] : scale;
      const sy = Array.isArray(scale) ? (scale[1] ?? scale[0]) : scale;
      const sz = Array.isArray(scale) ? (scale[2] ?? scale[0]) : scale;
      root.scaling.set(sx, sy, sz);

      if (entry.axes) {
        applyModelAxisCorrection(root, entry.axes);
      }

      const allMeshes = root
        .getChildMeshes(false)
        .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
      const pieceMeshes = filterDebrisPieceMeshes(allMeshes);
      disableMeshBackfaceCulling(pieceMeshes as AbstractMesh[]);
      applyMeshAlphaCutoff(pieceMeshes as AbstractMesh[]);
      root.setEnabled(false);

      const template: WreckTemplate = { root, pieceMeshes };
      this.cache.set(shipId, template);
      return template;
    } catch {
      warnMissingOnce(`wreck:${shipId}`);
      return null;
    }
  }

  dispose(): void {
    for (const template of this.cache.values()) {
      template.root.dispose();
    }
    this.cache.clear();
  }
}
