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
import {
  detectColliderMeshes,
  filterVisualLodMeshes,
  filterVisualMeshes,
} from './collider-mesh-detector';
import { detectFirePoints } from './firepoint-detector';
import { detectShipAnchors, type ShipAnchors } from './ship-anchor-detector';
import { LodShipLoader, type LodProgressCallback } from './lod-ship-loader';
import { createLodRuntimeState, type LodRuntimeState } from './lod-runtime';
import { DEFAULT_CULL_SCREEN_PERCENT } from './lod-config';

function createPlaceholderLodRuntime(
  root: TransformNode,
  lodMeshes: AbstractMesh[][]
): LodRuntimeState {
  return createLodRuntimeState(root, lodMeshes, [], DEFAULT_CULL_SCREEN_PERCENT);
}
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
  /** Invisible `collider` / `collider_*` meshes — follow animated parents for hit tests. */
  colliderMeshes: Mesh[];
  firePoints: ReturnType<typeof detectFirePoints>;
  anchors: ShipAnchors;
  visual: ShipVisualOptions;
  lodRuntime: LodRuntimeState;
  isPlaceholder: boolean;
  animationGroups: import('@babylonjs/core').AnimationGroup[];
}

function finalizeLoadedEntity(
  root: TransformNode,
  visualRoot: TransformNode,
  meshes: AbstractMesh[],
  lodMeshes: AbstractMesh[][],
  colliderRadius: number,
  extras: Omit<
    LoadedEntity,
    | 'root'
    | 'visualRoot'
    | 'meshes'
    | 'lodMeshes'
    | 'colliderRadius'
    | 'colliderMeshes'
    | 'lodRuntime'
    | 'animationGroups'
  > & { lodRuntime?: LodRuntimeState; animationGroups?: import('@babylonjs/core').AnimationGroup[] }
): LoadedEntity {
  const colliderMeshes = detectColliderMeshes(root);
  const visualMeshes = filterVisualMeshes(meshes, colliderMeshes);
  const visualLodMeshes = filterVisualLodMeshes(lodMeshes, colliderMeshes);
  const lodRuntime =
    extras.lodRuntime != null
      ? createLodRuntimeState(
          root,
          visualLodMeshes,
          extras.lodRuntime.screenThresholds,
          extras.lodRuntime.cullScreenPercent
        )
      : createPlaceholderLodRuntime(root, visualLodMeshes);

  const { lodRuntime: _ignored, animationGroups: _animIgnored, ...rest } = extras;

  return {
    root,
    visualRoot,
    meshes: visualMeshes,
    lodMeshes: visualLodMeshes,
    colliderRadius,
    colliderMeshes,
    lodRuntime,
    animationGroups: extras.animationGroups ?? [],
    ...rest,
  };
}

export class GltfShipLoader {
  private lodProgressCallback?: LodProgressCallback;

  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string,
    private readonly lodLoader: LodShipLoader
  ) {}

  setLodProgressCallback(callback?: LodProgressCallback): void {
    this.lodProgressCallback = callback;
  }

  async loadShip(id: string, entry: ShipManifestEntry): Promise<LoadedEntity> {
    const result = await this.lodLoader.loadWithLod(
      id,
      entry.lod,
      entry.scale,
      this.lodProgressCallback
    );
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      applyModelAxisCorrection(visualRoot, entry.axes);
      const anchors = detectShipAnchors(visualRoot);
      return finalizeLoadedEntity(
        result.root,
        visualRoot,
        result.meshes,
        result.lodMeshes,
        entry.colliderRadius,
        {
          firePoints: detectFirePoints(visualRoot),
          anchors,
          visual: resolveShipVisualOptions(entry.axes),
          lodRuntime: result.lodRuntime,
          animationGroups: result.animationGroups,
          isPlaceholder: false,
        }
      );
    }

    warnMissingOnce(`ship:${id}`);
    return this.createPlaceholderShip(id, entry);
  }

  async loadProp(id: string, entry: PropManifestEntry): Promise<LoadedEntity> {
    const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
    const result = await this.lodLoader.loadWithLod(
      id,
      entry.lod,
      scale,
      this.lodProgressCallback
    );
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      return finalizeLoadedEntity(
        result.root,
        visualRoot,
        result.meshes,
        result.lodMeshes,
        entry.colliderRadius,
        {
          firePoints: { fires: [], engines: [] },
          anchors: { engines: [], weapons: [] },
          visual: resolveShipVisualOptions(),
          lodRuntime: result.lodRuntime,
          animationGroups: result.animationGroups,
          isPlaceholder: false,
        }
      );
    }

    warnMissingOnce(`prop:${id}`);
    return this.createPlaceholderMeteor(entry.colliderRadius);
  }

  /** Preload every configured variant GLB once for randomized spawning. */
  async loadPropVariantTemplates(
    id: string,
    entry: PropManifestEntry
  ): Promise<LoadedEntity[]> {
    const paths = entry.variants;
    if (!paths?.length) {
      return [await this.loadProp(id, entry)];
    }

    const templates: LoadedEntity[] = [];
    for (const path of paths) {
      const variantId = path.split('/').pop()?.replace(/\.glb$/i, '') ?? id;
      templates.push(await this.loadPropMesh(variantId, path, entry));
    }

    if (templates.every((t) => t.isPlaceholder)) {
      warnMissingOnce(`prop:${id}:variants`);
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
    const lodMeshes = template.lodMeshes.length > 1 ? template.lodMeshes : [meshes];
    return finalizeLoadedEntity(
      root,
      visualRoot,
      meshes,
      lodMeshes,
      template.colliderRadius,
      {
        firePoints: { fires: [], engines: [] },
        anchors: { engines: [], weapons: [] },
        visual: template.visual,
        lodRuntime: createLodRuntimeState(
          root,
          lodMeshes,
          template.lodRuntime.screenThresholds,
          template.lodRuntime.cullScreenPercent
        ),
        isPlaceholder: template.isPlaceholder,
        animationGroups: [],
      }
    );
  }

  cloneShip(template: LoadedEntity, instanceId: string): LoadedEntity {
    const root = template.root.clone(instanceId, null) as TransformNode;
    const visualRoot =
      (root.getChildTransformNodes().find((n) => n.name.endsWith('_visual')) as
        | TransformNode
        | undefined) ?? root;
    const meshes = root.getChildMeshes(false) as AbstractMesh[];
    const lodMeshes = template.lodMeshes.length > 1 ? template.lodMeshes : [meshes];
    return finalizeLoadedEntity(
      root,
      visualRoot,
      meshes,
      lodMeshes,
      template.colliderRadius,
      {
        firePoints: template.firePoints,
        anchors: template.anchors,
        visual: template.visual,
        lodRuntime: createLodRuntimeState(
          root,
          lodMeshes,
          template.lodRuntime.screenThresholds,
          template.lodRuntime.cullScreenPercent
        ),
        isPlaceholder: template.isPlaceholder,
        animationGroups: [],
      }
    );
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
      return finalizeLoadedEntity(
        root,
        visualRoot,
        meshes,
        [meshes],
        entry.colliderRadius,
        {
          firePoints: { fires: [], engines: [] },
          anchors: { engines: [], weapons: [] },
          visual: resolveShipVisualOptions(),
          lodRuntime: createPlaceholderLodRuntime(root, [meshes]),
          animationGroups: result.animationGroups ?? [],
          isPlaceholder: false,
        }
      );
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
    return finalizeLoadedEntity(
      root,
      visualRoot,
      [body, nose],
      [[body, nose]],
      radius,
      {
        firePoints: detectFirePoints(root),
        anchors: detectShipAnchors(root),
        visual: resolveShipVisualOptions(entry.axes),
        lodRuntime: createPlaceholderLodRuntime(root, [[body, nose]]),
        animationGroups: [],
        isPlaceholder: true,
      }
    );
  }

  private createPlaceholderMeteor(radius: number): LoadedEntity {
    const root = new TransformNode('placeholder_meteor', this.scene);
    const visualRoot = attachVisualPivot(root, this.scene);
    const mesh = MeshBuilder.CreateIcoSphere('meteor', { radius: 1, subdivisions: 2 }, this.scene);
    mesh.parent = visualRoot;
    return finalizeLoadedEntity(
      root,
      visualRoot,
      [mesh],
      [[mesh]],
      radius,
      {
        firePoints: { fires: [], engines: [] },
        anchors: { engines: [], weapons: [] },
        visual: resolveShipVisualOptions(),
        lodRuntime: createPlaceholderLodRuntime(root, [[mesh]]),
        animationGroups: [],
        isPlaceholder: true,
      }
    );
  }
}
