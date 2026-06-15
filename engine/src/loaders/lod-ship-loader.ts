import {
  AbstractMesh,
  AnimationGroup,
  Mesh,
  QuadraticErrorSimplification,
  Scene,
  SceneLoader,
  TransformNode,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { disableMeshBackfaceCulling } from '../render/mesh-material-utils';
import {
  resolveLodPlan,
  type LodManifestValue,
  type ResolvedLodPlan,
} from './lod-config';
import { resolveDistanceThresholdsForLevelCount, resolveThresholdsForLevelCount } from './lod-babylon';
import { createLodRuntimeState, type LodRuntimeState } from './lod-runtime';
import { attachGltfImportToParent } from './gltf-import-utils';
import { markSceneNodeGenerated } from './scene-node-origin';
import { discoverSiblingLodPaths } from './lod-discovery';

export interface LodLoadProgress {
  phase: 'loading' | 'simplifying' | 'done';
  modelId: string;
  message: string;
  current?: number;
  total?: number;
}

export type LodProgressCallback = (progress: LodLoadProgress) => void;

export interface LodResult {
  root: TransformNode;
  meshes: AbstractMesh[];
  lodMeshes: AbstractMesh[][];
  lodRuntime: LodRuntimeState;
  animationGroups: AnimationGroup[];
}

function cloneMeshGroup(
  meshes: AbstractMesh[],
  root: TransformNode,
  suffix: string,
): AbstractMesh[] {
  return meshes.map((m) => {
    const clone = m.clone(`${m.name}${suffix}`, root) as AbstractMesh;
    markSceneNodeGenerated(clone);
    clone.setEnabled(false);
    clone.isVisible = false;
    return clone;
  });
}

function simplifyMesh(mesh: Mesh, quality: number): Promise<Mesh> {
  return new Promise((resolve, reject) => {
    try {
      const simplifier = new QuadraticErrorSimplification(mesh);
      simplifier.simplify({ quality, distance: 0, optimizeMesh: true }, (simplified) =>
        resolve(simplified),
      );
    } catch (err) {
      reject(err);
    }
  });
}

async function generateAutoLodGroup(
  sourceMeshes: AbstractMesh[],
  root: TransformNode,
  quality: number,
  suffix: string,
  onProgress?: LodProgressCallback,
  modelId?: string,
  taskIndex?: number,
  taskTotal?: number,
): Promise<AbstractMesh[]> {
  const simplified: AbstractMesh[] = [];
  const meshSources = sourceMeshes.filter((m) => m instanceof Mesh) as Mesh[];

  for (let i = 0; i < meshSources.length; i++) {
    const source = meshSources[i];
    onProgress?.({
      phase: 'simplifying',
      modelId: modelId ?? 'model',
      message: `Simplifying ${modelId ?? 'model'} LOD (${i + 1}/${meshSources.length})…`,
      current: taskIndex,
      total: taskTotal,
    });

    try {
      const result = await simplifyMesh(source, quality);
      result.parent = root;
      result.name = `${source.name}${suffix}`;
      markSceneNodeGenerated(result);
      result.setEnabled(false);
      result.isVisible = false;
      simplified.push(result);
    } catch {
      const fallback = source.clone(`${source.name}${suffix}_fb`, root) as AbstractMesh;
      markSceneNodeGenerated(fallback);
      fallback.setEnabled(false);
      fallback.isVisible = false;
      simplified.push(fallback);
    }
  }

  const nonMesh = sourceMeshes.filter((m) => !(m instanceof Mesh));
  for (const m of nonMesh) {
    const fallback = m.clone(`${m.name}${suffix}_fb`, root) as AbstractMesh;
    markSceneNodeGenerated(fallback);
    fallback.setEnabled(false);
    fallback.isVisible = false;
    simplified.push(fallback);
  }

  return simplified;
}

export class LodShipLoader {
  private readonly warnedUrls = new Set<string>();
  private readonly loadProbeCache = new Map<string, boolean>();

  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string,
  ) {}

  async loadWithLod(
    id: string,
    lod: LodManifestValue | undefined,
    scale: number | [number, number, number],
    onProgress?: LodProgressCallback,
  ): Promise<LodResult | null> {
    const plan = resolveLodPlan(lod);
    return this.loadFromPlan(id, plan, scale, onProgress);
  }

  private async loadFromPlan(
    id: string,
    plan: ResolvedLodPlan,
    scale: number | [number, number, number],
    onProgress?: LodProgressCallback,
  ): Promise<LodResult | null> {
    if (plan.levels.length === 0) {
      return null;
    }

    const root = new TransformNode(`${id}_root`, this.scene);
    const lodMeshes: AbstractMesh[][] = [];
    let lastMeshes: AbstractMesh[] | null = null;
    let autoSourceMeshes: AbstractMesh[] | null = null;
    let animationGroups: AnimationGroup[] = [];

    const manualPaths = await this.resolveManualLodPaths(plan);
    if (manualPaths.length === 0) {
      root.dispose();
      return null;
    }

    for (let i = 0; i < manualPaths.length; i++) {
      const path = manualPaths[i];
      onProgress?.({
        phase: 'loading',
        modelId: id,
        message: `Loading ${id} LOD${i}…`,
        current: i + 1,
        total: manualPaths.length,
      });

      const loaded = await this.loadManualGlb(id, path, root, i);
      if (loaded) {
        loaded.meshes.forEach((m) => {
          m.setEnabled(i === 0);
          m.isVisible = i === 0;
        });
        lodMeshes.push(loaded.meshes);
        lastMeshes = loaded.meshes;
        autoSourceMeshes = loaded.meshes;
        if (animationGroups.length === 0 && loaded.animationGroups.length > 0) {
          animationGroups = loaded.animationGroups;
        }
      } else if (lastMeshes) {
        const fallback = cloneMeshGroup(lastMeshes, root, `_lod${i}_fb`);
        fallback.forEach((m) => {
          m.setEnabled(i === 0);
          m.isVisible = i === 0;
        });
        lodMeshes.push(fallback);
      }
    }

    const explicitAutoLevels = plan.levels.filter(
      (level) => level.kind === 'auto' && level.quality != null,
    );
    const autoQualities =
      explicitAutoLevels.length > 0
        ? explicitAutoLevels.map((level) => level.quality!)
        : plan.enableAutoSimplify && lodMeshes.length === 1
          ? plan.autoQualities
          : [];

    for (let i = 0; i < autoQualities.length; i++) {
      const quality = autoQualities[i];
      const source = autoSourceMeshes ?? lastMeshes;
      if (!source || source.length === 0) continue;

      const lodIndex = lodMeshes.length;
      onProgress?.({
        phase: 'simplifying',
        modelId: id,
        message: `Generating ${id} LOD${lodIndex} (auto)…`,
        current: i + 1,
        total: autoQualities.length,
      });

      const lodContainer = new TransformNode(`${id}_lod${lodIndex}`, this.scene);
      markSceneNodeGenerated(lodContainer);
      lodContainer.parent = root;
      const generated = await generateAutoLodGroup(
        source,
        lodContainer,
        quality,
        `_lod${lodIndex}_auto`,
        onProgress,
        id,
        i + 1,
        autoQualities.length,
      );
      generated.forEach((m) => {
        m.setEnabled(false);
        m.isVisible = false;
      });
      lodMeshes.push(generated);
      lastMeshes = generated;
    }

    if (lodMeshes.length === 0) {
      root.dispose();
      return null;
    }

    const sx = Array.isArray(scale) ? scale[0] : scale;
    const sy = Array.isArray(scale) ? (scale[1] ?? scale[0]) : scale;
    const sz = Array.isArray(scale) ? (scale[2] ?? scale[0]) : scale;
    root.scaling.set(sx, sy, sz);

    const screenThresholds = resolveThresholdsForLevelCount(
      plan.screenThresholds,
      lodMeshes.length,
    );
    const distanceThresholds = resolveDistanceThresholdsForLevelCount(
      plan.distanceThresholds,
      lodMeshes.length,
    );
    const lod0Meshes = lodMeshes[0] ?? [];
    disableMeshBackfaceCulling(lodMeshes.flat());

    const lodRuntime = createLodRuntimeState(
      root,
      lodMeshes,
      lod0Meshes,
      {
        metric: plan.metric,
        screenThresholds,
        cullScreenPercent: plan.cullScreenPercent,
        distanceThresholds,
        cullDistance: plan.cullDistance,
      },
    );

    onProgress?.({
      phase: 'done',
      modelId: id,
      message: `Loaded ${id}`,
    });

    return {
      root,
      meshes: lod0Meshes,
      lodMeshes,
      lodRuntime,
      animationGroups,
    };
  }

  private async resolveManualLodPaths(plan: ResolvedLodPlan): Promise<string[]> {
    const explicit = plan.levels
      .filter((level) => level.kind === 'manual' && level.path)
      .map((level) => level.path!);

    if (explicit.length === 0) return [];

    if (explicit.length > 1 || !plan.discoverSiblingLods) {
      return explicit;
    }

    return discoverSiblingLodPaths(
      (path) => this.probeGlbExists(path),
      explicit[0],
    );
  }

  private async probeGlbExists(relativePath: string): Promise<boolean> {
    const cached = this.loadProbeCache.get(relativePath);
    if (cached !== undefined) return cached;

    const url = `${this.baseUrl}/${relativePath}`;
    try {
      let response = await fetch(url, { method: 'HEAD' });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
        });
      }
      const ok = response.ok || response.status === 206;
      this.loadProbeCache.set(relativePath, ok);
      return ok;
    } catch {
      this.loadProbeCache.set(relativePath, false);
      return false;
    }
  }

  private async loadManualGlb(
    id: string,
    relativePath: string,
    root: TransformNode,
    lodIndex: number,
  ): Promise<{ meshes: AbstractMesh[]; animationGroups: AnimationGroup[] } | null> {
    const url = `${this.baseUrl}/${relativePath}`;
    try {
      const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
      if (result.meshes.length === 0 && (result.transformNodes?.length ?? 0) === 0) {
        return null;
      }

      const lodContainer = new TransformNode(`${id}_lod${lodIndex}`, this.scene);
      lodContainer.parent = root;
      const meshes = attachGltfImportToParent(result, lodContainer);
      return { meshes, animationGroups: result.animationGroups ?? [] };
    } catch {
      if (!this.warnedUrls.has(url)) {
        this.warnedUrls.add(url);
        console.warn(`[LOD] failed to load ${url}`);
      }
      return null;
    }
  }
}
