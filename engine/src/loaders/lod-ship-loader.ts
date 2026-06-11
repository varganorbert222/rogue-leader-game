import {
  AbstractMesh,
  Mesh,
  QuadraticErrorSimplification,
  Scene,
  SceneLoader,
  TransformNode,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { disableMeshBackfaceCulling } from '../render/mesh-material-utils';
import { resolveLodPlan, type LodManifestValue, type ResolvedLodPlan } from './lod-config';
import { createLodRuntimeState, type LodRuntimeState } from './lod-runtime';
import { attachGltfImportToParent } from './gltf-import-utils';

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
}

function cloneMeshGroup(
  meshes: AbstractMesh[],
  root: TransformNode,
  suffix: string
): AbstractMesh[] {
  return meshes.map((m) => {
    const clone = m.clone(`${m.name}${suffix}`, root) as AbstractMesh;
    clone.setEnabled(false);
    return clone;
  });
}

function simplifyMesh(mesh: Mesh, quality: number): Promise<Mesh> {
  return new Promise((resolve, reject) => {
    try {
      const simplifier = new QuadraticErrorSimplification(mesh);
      simplifier.simplify({ quality, distance: 0, optimizeMesh: true }, (simplified) =>
        resolve(simplified)
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
  taskTotal?: number
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
      result.setEnabled(false);
      simplified.push(result);
    } catch {
      const fallback = source.clone(`${source.name}${suffix}_fb`, root) as AbstractMesh;
      fallback.setEnabled(false);
      simplified.push(fallback);
    }
  }

  const nonMesh = sourceMeshes.filter((m) => !(m instanceof Mesh));
  for (const m of nonMesh) {
    const fallback = m.clone(`${m.name}${suffix}_fb`, root) as AbstractMesh;
    fallback.setEnabled(false);
    simplified.push(fallback);
  }

  return simplified;
}

export class LodShipLoader {
  private readonly warnedUrls = new Set<string>();

  constructor(
    private readonly scene: Scene,
    private readonly baseUrl: string
  ) {}

  async loadWithLod(
    id: string,
    lod: LodManifestValue | undefined,
    scale: number | [number, number, number],
    onProgress?: LodProgressCallback
  ): Promise<LodResult | null> {
    const plan = resolveLodPlan(lod);
    return this.loadFromPlan(id, plan, scale, onProgress);
  }

  private async loadFromPlan(
    id: string,
    plan: ResolvedLodPlan,
    scale: number | [number, number, number],
    onProgress?: LodProgressCallback
  ): Promise<LodResult | null> {
    if (plan.levels.length === 0) {
      return null;
    }

    const root = new TransformNode(`${id}_root`, this.scene);
    const lodMeshes: AbstractMesh[][] = [];
    let lastMeshes: AbstractMesh[] | null = null;
    let autoSourceMeshes: AbstractMesh[] | null = null;

    const autoTasks = plan.levels.filter((l) => l.kind === 'auto').length;
    let autoTaskIndex = 0;

    for (let i = 0; i < plan.levels.length; i++) {
      const level = plan.levels[i];

      if (level.kind === 'manual' && level.path) {
        onProgress?.({
          phase: 'loading',
          modelId: id,
          message: `Loading ${id} LOD${i}…`,
          current: i + 1,
          total: plan.levels.length,
        });

        const loaded = await this.loadManualGlb(id, level.path, root, i);
        if (loaded) {
          loaded.forEach((m) => m.setEnabled(i === 0));
          lodMeshes.push(loaded);
          lastMeshes = loaded;
          autoSourceMeshes = loaded;
        } else if (lastMeshes) {
          const fallback = cloneMeshGroup(lastMeshes, root, `_lod${i}_fb`);
          fallback.forEach((m) => m.setEnabled(i === 0));
          lodMeshes.push(fallback);
        }
        continue;
      }

      if (level.kind === 'auto' && level.quality != null) {
        const source = autoSourceMeshes ?? lastMeshes;
        if (!source || source.length === 0) {
          continue;
        }

        autoTaskIndex++;
        onProgress?.({
          phase: 'simplifying',
          modelId: id,
          message: `Generating ${id} LOD${i} (auto)…`,
          current: autoTaskIndex,
          total: autoTasks,
        });

        const generated = await generateAutoLodGroup(
          source,
          root,
          level.quality,
          `_lod${i}_auto`,
          onProgress,
          id,
          autoTaskIndex,
          autoTasks
        );
        generated.forEach((m) => m.setEnabled(false));
        lodMeshes.push(generated);
        lastMeshes = generated;
        continue;
      }
    }

    if (lodMeshes.length === 0) {
      root.dispose();
      return null;
    }

    const sx = Array.isArray(scale) ? scale[0] : scale;
    const sy = Array.isArray(scale) ? (scale[1] ?? scale[0]) : scale;
    const sz = Array.isArray(scale) ? (scale[2] ?? scale[0]) : scale;
    root.scaling.set(sx, sy, sz);

    const allMeshes = lodMeshes.flat();
    disableMeshBackfaceCulling(allMeshes);

    const lodRuntime = createLodRuntimeState(
      root,
      lodMeshes,
      plan.screenThresholds,
      plan.cullScreenPercent
    );

    onProgress?.({
      phase: 'done',
      modelId: id,
      message: `Loaded ${id}`,
    });

    return { root, meshes: allMeshes, lodMeshes, lodRuntime };
  }

  private async loadManualGlb(
    id: string,
    relativePath: string,
    root: TransformNode,
    lodIndex: number
  ): Promise<AbstractMesh[] | null> {
    const url = `${this.baseUrl}/${relativePath}`;
    try {
      const result = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
      if (result.meshes.length === 0 && (result.transformNodes?.length ?? 0) === 0) {
        return null;
      }

      const lodContainer = new TransformNode(`${id}_lod${lodIndex}`, this.scene);
      lodContainer.parent = root;
      return attachGltfImportToParent(result, lodContainer);
    } catch {
      if (!this.warnedUrls.has(url)) {
        this.warnedUrls.add(url);
        console.warn(`[LOD] failed to load ${url}`);
      }
      return null;
    }
  }
}
