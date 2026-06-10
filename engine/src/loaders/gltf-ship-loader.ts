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
import { discoverNumberedGlbVariants } from './meteor-variant-discovery';
import { detectFirePoints } from './firepoint-detector';
import { detectShipAnchors, type ShipAnchors } from './ship-anchor-detector';
import { LodShipLoader } from './lod-ship-loader';
import { attachVisualPivot } from './visual-pivot';
import { disableMeshBackfaceCulling } from '../render/mesh-material-utils';
import { applyModelAxisCorrection, resolveShipVisualOptions } from './ship-axis-convention';
import type { ShipVisualOptions } from './ship-axis-convention';

export interface LoadedEntity {
  root: TransformNode;
  /** Child of root — cosmetic banking; physics stay on root. */
  visualRoot: TransformNode;
  meshes: AbstractMesh[];
  lodMeshes: AbstractMesh[][];
  colliderRadius: number;
  firePoints: ReturnType<typeof detectFirePoints>;
  anchors: ShipAnchors;
  visual: ShipVisualOptions;
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
      applyModelAxisCorrection(visualRoot, entry.axes);
      const anchors = detectShipAnchors(result.root);
      return {
        root: result.root,
        visualRoot,
        meshes: result.meshes,
        lodMeshes: result.lodMeshes,
        colliderRadius: entry.colliderRadius,
        firePoints: detectFirePoints(result.root),
        anchors,
        visual: resolveShipVisualOptions(entry.axes),
        isPlaceholder: false,
      };
    }

    warnMissingOnce(`ship:${id}`);
    return this.createPlaceholderShip(id, entry);
  }

  async loadProp(id: string, entry: PropManifestEntry): Promise<LoadedEntity> {
    const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
    const lodPaths = entry.lod ?? [];
    const result = await this.lodLoader.loadWithLod(id, lodPaths, scale);
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      return {
        root: result.root,
        visualRoot,
        meshes: result.meshes,
        lodMeshes: result.lodMeshes,
        colliderRadius: entry.colliderRadius,
        firePoints: { fires: [], engines: [] },
        anchors: { engines: [], weapons: [] },
        visual: resolveShipVisualOptions(),
        isPlaceholder: false,
      };
    }

    warnMissingOnce(`prop:${id}`);
    return this.createPlaceholderMeteor(entry.colliderRadius);
  }

  /** Discover and preload every numbered meteor GLB once (meteor_01, meteor_02, …). */
  async loadMeteorVariantTemplates(
    id: string,
    entry: PropManifestEntry
  ): Promise<LoadedEntity[]> {
    const dir = entry.variantDir;
    const prefix = entry.variantPrefix;
    if (!dir || !prefix) {
      const single = await this.loadProp(id, entry);
      return [single];
    }

    const paths = await discoverNumberedGlbVariants(
      this.baseUrl,
      dir,
      prefix,
      entry.variantPad ?? 2
    );

    if (paths.length === 0) {
      warnMissingOnce(`prop:${id}:variants`);
      return [this.createPlaceholderMeteor(entry.colliderRadius)];
    }

    const templates: LoadedEntity[] = [];
    for (const path of paths) {
      const variantId = path.split('/').pop()?.replace(/\.glb$/i, '') ?? id;
      const loaded = await this.loadPropMesh(variantId, path, entry);
      templates.push(loaded);
    }
    return templates;
  }

  cloneProp(template: LoadedEntity, instanceId: string): LoadedEntity {
    const root = template.root.clone(instanceId, null) as TransformNode;
    const visualRoot =
      (root.getChildTransformNodes().find((n) => n.name.endsWith('_visual')) as
        | TransformNode
        | undefined) ?? root;
    const meshes = root.getChildMeshes(false) as AbstractMesh[];
    return {
      root,
      visualRoot,
      meshes,
      lodMeshes: [meshes],
      colliderRadius: template.colliderRadius,
      firePoints: { fires: [], engines: [] },
      anchors: { engines: [], weapons: [] },
      visual: template.visual,
      isPlaceholder: template.isPlaceholder,
    };
  }

  private async loadPropMesh(
    id: string,
    glbPath: string,
    entry: PropManifestEntry
  ): Promise<LoadedEntity> {
    const url = `${this.baseUrl}/${glbPath}`;
    try {
      const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
      if (result.meshes.length === 0) {
        throw new Error('empty mesh');
      }
      const root = new TransformNode(`${id}_root`, this.scene);
      const meshes = result.meshes.filter((m) => m instanceof AbstractMesh) as AbstractMesh[];
      meshes.forEach((m) => {
        m.parent = root;
      });
      const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
      root.scaling.set(scale, scale, scale);
      const visualRoot = attachVisualPivot(root, this.scene);
      return {
        root,
        visualRoot,
        meshes,
        lodMeshes: [meshes],
        colliderRadius: entry.colliderRadius,
        firePoints: { fires: [], engines: [] },
        anchors: { engines: [], weapons: [] },
        visual: resolveShipVisualOptions(),
        isPlaceholder: false,
      };
    } catch {
      warnMissingOnce(`prop:${id}`);
      return this.createPlaceholderMeteor(entry.colliderRadius);
    }
  }

  private createPlaceholderShip(id: string, entry: ShipManifestEntry): LoadedEntity {
    const radius = entry.colliderRadius;
    const root = new TransformNode(`placeholder_${id}`, this.scene);
    const visualRoot = new TransformNode(`${id}_visual`, this.scene);
    visualRoot.parent = root;
    const body = MeshBuilder.CreateBox(`${id}_body`, { width: 2, height: 0.6, depth: 3 }, this.scene);
    body.parent = visualRoot;
    const nose = MeshBuilder.CreateCylinder(`${id}_nose`, { diameterTop: 0, diameterBottom: 0.8, height: 1.2 }, this.scene);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -2;
    nose.parent = visualRoot;
    disableMeshBackfaceCulling([body, nose]);
    applyModelAxisCorrection(visualRoot, entry.axes);
    return {
      root,
      visualRoot,
      meshes: [body, nose],
      lodMeshes: [[body, nose]],
      colliderRadius: radius,
      firePoints: detectFirePoints(root),
      anchors: detectShipAnchors(root),
      visual: resolveShipVisualOptions(entry.axes),
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
      anchors: { engines: [], weapons: [] },
      visual: resolveShipVisualOptions(),
      isPlaceholder: true,
    };
  }
}
