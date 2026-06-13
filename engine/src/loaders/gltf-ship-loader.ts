import {
  AbstractMesh,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { ShipManifestEntry, PropManifestEntry } from "./asset-manifest";
import { warnMissingOnce } from "./asset-manifest";
import {
  detectColliderMeshes,
  filterVisualLodMeshes,
  filterVisualMeshes,
  applyPropColliderPolicy,
} from "./collider-mesh-detector";
import { detectFirePoints } from "./firepoint-detector";
import { detectShipAnchors, type ShipAnchors } from "./ship-anchor-detector";
import { LodShipLoader, type LodProgressCallback } from "./lod-ship-loader";
import { createLodRuntimeState, type LodRuntimeState } from "./lod-runtime";
import { DEFAULT_CULL_DISTANCE, DEFAULT_CULL_SCREEN_PERCENT, defaultDistanceThresholds, defaultScreenThresholds } from "./lod-config";
import { prepareLodMeshGroups } from "./lod-babylon";

function createPlaceholderLodRuntime(
  root: TransformNode,
  lodMeshes: AbstractMesh[][],
): LodRuntimeState {
  return createLodRuntimeState(
    root,
    lodMeshes,
    lodMeshes[0] ?? [],
    {
      metric: 'screen',
      screenThresholds: [],
      cullScreenPercent: DEFAULT_CULL_SCREEN_PERCENT,
      distanceThresholds: [],
      cullDistance: DEFAULT_CULL_DISTANCE,
    },
  );
}
import { attachVisualPivot } from "./visual-pivot";
import { attachGltfImportToParent } from "./gltf-import-utils";
import {
  cloneLoadedEntityRoot,
  collectDescendantMeshes,
  findVisualRoot,
  remapLodMeshGroups,
} from "./clone-entity-utils";
import { disableMeshBackfaceCulling } from "../render/mesh-material-utils";
import {
  shareMaterialsFromTemplate,
  optimizeLoadedEntityMeshes,
} from '../render/mesh-batching';
import {
  preparePropInstanceTemplate,
  spawnPropInstancesFromTemplate,
} from './prop-instance-spawn';
import { PropInstanceGroup } from '../render/prop-instance-group';
import {
  applyModelAxisCorrection,
  resolveShipVisualOptions,
} from "./ship-axis-convention";
import type { ShipVisualOptions } from "./ship-axis-convention";

export interface LoadedEntity {
  root: TransformNode;
  /** Child of root — cosmetic banking; physics stay on root. */
  visualRoot: TransformNode;
  meshes: AbstractMesh[];
  lodMeshes: AbstractMesh[][];
  colliderRadius: number;
  /** Invisible `collider` / `collider_*` meshes — follow animated parents for hit tests. */
  colliderMeshes: AbstractMesh[];
  firePoints: ReturnType<typeof detectFirePoints>;
  anchors: ShipAnchors;
  visual: ShipVisualOptions;
  lodRuntime: LodRuntimeState;
  isPlaceholder: boolean;
  animationGroups: import("@babylonjs/core").AnimationGroup[];
}

function finalizeLoadedEntity(
  root: TransformNode,
  visualRoot: TransformNode,
  meshes: AbstractMesh[],
  lodMeshes: AbstractMesh[][],
  colliderRadius: number,
  extras: Omit<
    LoadedEntity,
    | "root"
    | "visualRoot"
    | "meshes"
    | "lodMeshes"
    | "colliderRadius"
    | "colliderMeshes"
    | "lodRuntime"
    | "animationGroups"
  > & {
    lodRuntime?: LodRuntimeState;
    animationGroups?: import("@babylonjs/core").AnimationGroup[];
  },
): LoadedEntity {
  const colliderMeshes = detectColliderMeshes(root);
  const visualMeshes = filterVisualMeshes(meshes, colliderMeshes);
  const visualLodMeshes = filterVisualLodMeshes(lodMeshes, colliderMeshes);

  const lodRuntimeInput = extras.lodRuntime;
  const screenThresholds =
    lodRuntimeInput?.screenThresholds ??
    defaultScreenThresholds(visualLodMeshes.length);
  const cullScreenPercent =
    lodRuntimeInput?.cullScreenPercent ?? DEFAULT_CULL_SCREEN_PERCENT;
  const distanceThresholds =
    lodRuntimeInput?.distanceThresholds ??
    defaultDistanceThresholds(visualLodMeshes.length);
  const cullDistance =
    lodRuntimeInput?.cullDistance ?? DEFAULT_CULL_DISTANCE;
  const metric = lodRuntimeInput?.metric ?? 'screen';

  prepareLodMeshGroups(visualLodMeshes);

  const lodRuntime = createLodRuntimeState(
    root,
    visualLodMeshes,
    visualLodMeshes[0] ?? [],
    {
      metric,
      screenThresholds,
      cullScreenPercent,
      distanceThresholds,
      cullDistance,
    },
  );

  const {
    lodRuntime: _ignored,
    animationGroups: _animIgnored,
    ...rest
  } = extras;

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
    private readonly lodLoader: LodShipLoader,
  ) {}

  setLodProgressCallback(callback?: LodProgressCallback): void {
    this.lodProgressCallback = callback;
  }

  async loadShip(id: string, entry: ShipManifestEntry): Promise<LoadedEntity> {
    const result = await this.lodLoader.loadWithLod(
      id,
      entry.lod,
      entry.scale,
      this.lodProgressCallback,
    );
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      applyModelAxisCorrection(visualRoot, entry.axes);
      const anchors = detectShipAnchors(visualRoot);
      const loaded = finalizeLoadedEntity(
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
        },
      );
      optimizeLoadedEntityMeshes(loaded);
      return loaded;
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
      this.lodProgressCallback,
    );
    if (result) {
      const visualRoot = attachVisualPivot(result.root, this.scene);
      const loaded = finalizeLoadedEntity(
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
        },
      );
      applyPropColliderPolicy(loaded, entry);
      optimizeLoadedEntityMeshes(loaded);
      return loaded;
    }

    warnMissingOnce(`prop:${id}`);
    return this.createPlaceholderAsteroid(entry);
  }

  /** Preload every configured variant GLB once for randomized spawning. */
  async loadPropVariantTemplates(
    id: string,
    entry: PropManifestEntry,
  ): Promise<LoadedEntity[]> {
    const paths = entry.variants;
    if (!paths?.length) {
      return [await this.loadProp(id, entry)];
    }

    const templates: LoadedEntity[] = [];
    for (const path of paths) {
      const variantId =
        path
          .split("/")
          .pop()
          ?.replace(/\.glb$/i, "") ?? id;
      templates.push(await this.loadPropMesh(variantId, path, entry));
    }

    if (templates.every((t) => t.isPlaceholder)) {
      warnMissingOnce(`prop:${id}:variants`);
    }

    return templates;
  }

  /** Hide template meshes and keep them enabled for `createInstance()`. */
  preparePropInstanceTemplate(template: LoadedEntity): void {
    preparePropInstanceTemplate(template);
  }

  /**
   * Create a per-variant instance group. All spawns from the group batch into the same draw calls.
   */
  createPropInstanceGroup(
    template: LoadedEntity,
    groupName: string,
    entry: PropManifestEntry,
  ): PropInstanceGroup {
    const scene = template.root.getScene();
    if (!scene) {
      throw new Error(`Cannot create prop instance group "${groupName}": template has no scene`);
    }
    return PropInstanceGroup.create(scene, groupName, template, entry);
  }

  /**
   * Spawn a single prop instance (prefer {@link createPropInstanceGroup} for many props of the same variant).
   */
  instanceProp(
    template: LoadedEntity,
    instanceId: string,
    entry: PropManifestEntry,
  ): LoadedEntity {
    if (template.isPlaceholder) {
      return this.cloneProp(template, instanceId, entry);
    }
    return spawnPropInstancesFromTemplate(template, instanceId, entry);
  }

  cloneProp(
    template: LoadedEntity,
    instanceId: string,
    entry: PropManifestEntry,
  ): LoadedEntity {
    const root = cloneLoadedEntityRoot(template.root, instanceId);
    const visualRoot = findVisualRoot(root);
    const allMeshes = collectDescendantMeshes(root);
    const lodMeshes = this.resolveClonedLodMeshes(template, root, allMeshes);
    const loaded = finalizeLoadedEntity(
      root,
      visualRoot,
      allMeshes,
      lodMeshes,
      template.colliderRadius,
      {
        firePoints: { fires: [], engines: [] },
        anchors: { engines: [], weapons: [] },
        visual: template.visual,
        lodRuntime: template.lodRuntime,
        isPlaceholder: template.isPlaceholder,
        animationGroups: [],
      },
    );
    applyPropColliderPolicy(loaded, entry);
    shareMaterialsFromTemplate(
      template.meshes,
      template.root,
      loaded.meshes,
      loaded.root,
    );
    optimizeLoadedEntityMeshes(loaded);
    return loaded;
  }

  cloneShip(template: LoadedEntity, instanceId: string): LoadedEntity {
    const root = cloneLoadedEntityRoot(template.root, instanceId);
    const visualRoot = findVisualRoot(root);
    const allMeshes = collectDescendantMeshes(root);
    const lodMeshes = this.resolveClonedLodMeshes(template, root, allMeshes);
    const loaded = finalizeLoadedEntity(
      root,
      visualRoot,
      allMeshes,
      lodMeshes,
      template.colliderRadius,
      {
        firePoints: detectFirePoints(visualRoot),
        anchors: detectShipAnchors(visualRoot),
        visual: template.visual,
        lodRuntime: template.lodRuntime,
        isPlaceholder: template.isPlaceholder,
        animationGroups: [],
      },
    );
    shareMaterialsFromTemplate(
      template.meshes,
      template.root,
      loaded.meshes,
      loaded.root,
    );
    optimizeLoadedEntityMeshes(loaded);
    return loaded;
  }

  private resolveClonedLodMeshes(
    template: LoadedEntity,
    clonedRoot: TransformNode,
    allMeshes: AbstractMesh[],
  ): AbstractMesh[][] {
    if (template.lodMeshes.length === 0) {
      return [allMeshes];
    }

    const remapped = remapLodMeshGroups(
      template.lodMeshes,
      template.root,
      clonedRoot,
    );
    if (remapped.some((group) => group.length > 0)) {
      return remapped;
    }

    const colliderMeshes = detectColliderMeshes(clonedRoot);
    return [filterVisualMeshes(allMeshes, colliderMeshes)];
  }

  private async loadPropMesh(
    id: string,
    glbPath: string,
    entry: PropManifestEntry,
  ): Promise<LoadedEntity> {
    const url = `${this.baseUrl}/${glbPath}`;
    try {
      const result = await SceneLoader.ImportMeshAsync("", url, "", this.scene);
      if (
        result.meshes.length === 0 &&
        (result.transformNodes?.length ?? 0) === 0
      ) {
        throw new Error("empty mesh");
      }
      const root = new TransformNode(`${id}_root`, this.scene);
      const meshes = attachGltfImportToParent(result, root);
      const scale = Array.isArray(entry.scale) ? entry.scale[1] : entry.scale;
      root.scaling.set(scale, scale, scale);
      const visualRoot = attachVisualPivot(root, this.scene);
      const loaded = finalizeLoadedEntity(
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
        },
      );
      applyPropColliderPolicy(loaded, entry);
      optimizeLoadedEntityMeshes(loaded);
      return loaded;
    } catch {
      warnMissingOnce(`prop:${id}`);
      return this.createPlaceholderAsteroid(entry);
    }
  }

  private createPlaceholderShip(
    id: string,
    entry: ShipManifestEntry,
  ): LoadedEntity {
    const radius = entry.colliderRadius;
    const root = new TransformNode(`placeholder_${id}`, this.scene);
    const visualRoot = new TransformNode(`${id}_visual`, this.scene);
    visualRoot.parent = root;
    const body = MeshBuilder.CreateBox(
      `${id}_body`,
      { width: 2, height: 0.6, depth: 3 },
      this.scene,
    );
    body.parent = visualRoot;
    const nose = MeshBuilder.CreateCylinder(
      `${id}_nose`,
      { diameterTop: 0, diameterBottom: 0.8, height: 1.2 },
      this.scene,
    );
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
      },
    );
  }

  private createPlaceholderAsteroid(entry: PropManifestEntry): LoadedEntity {
    const radius = entry.colliderRadius;
    const root = new TransformNode("placeholder_asteroid", this.scene);
    const visualRoot = attachVisualPivot(root, this.scene);
    const mesh = MeshBuilder.CreateIcoSphere(
      "asteroid",
      { radius: 1, subdivisions: 2 },
      this.scene,
    );
    mesh.parent = visualRoot;
    const loaded = finalizeLoadedEntity(root, visualRoot, [mesh], [[mesh]], radius, {
      firePoints: { fires: [], engines: [] },
      anchors: { engines: [], weapons: [] },
      visual: resolveShipVisualOptions(),
      lodRuntime: createPlaceholderLodRuntime(root, [[mesh]]),
      animationGroups: [],
      isPlaceholder: true,
    });
    applyPropColliderPolicy(loaded, entry);
    return loaded;
  }
}
