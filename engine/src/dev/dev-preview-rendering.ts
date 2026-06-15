import type { Camera } from "@babylonjs/core";
import type { BabylonHost } from "../core/babylon-host";
import { RuntimePaths } from "../runtime-paths";
import {
  SceneBloomPipeline,
  type SceneBloomConfig,
} from "../render/scene-bloom-pipeline";
import type { AbstractMesh } from "@babylonjs/core";
import { applyMeshEmissiveBloomStrength } from "../render/mesh-material-utils";
import { preloadVfxTextures } from "../vfx/vfx-textures";

const DEFAULT_BLOOM: SceneBloomConfig = {
  enabled: true,
  weight: 2.0,
  threshold: 0.25,
  kernel: 64,
  scale: 1.0,
  projectiles: { strength: 2 },
  emissive: { strength: 1 },
};

export async function loadDevRenderBloomConfig(
  url = RuntimePaths.renderConfig,
): Promise<SceneBloomConfig> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ...DEFAULT_BLOOM };
    const json = (await res.json()) as { bloom?: Partial<SceneBloomConfig> };
    const bloom = json.bloom ?? {};
    return {
      ...DEFAULT_BLOOM,
      ...bloom,
      projectiles: { ...DEFAULT_BLOOM.projectiles, ...bloom.projectiles },
      emissive: { ...DEFAULT_BLOOM.emissive, ...bloom.emissive },
    };
  } catch {
    return { ...DEFAULT_BLOOM };
  }
}

/** Match in-game bloom + emissive tuning for dev preview canvases. */
export class DevPreviewRendering {
  private readonly bloomPipeline = new SceneBloomPipeline();
  private bloomConfig: SceneBloomConfig = { ...DEFAULT_BLOOM };

  async attach(host: BabylonHost, camera: Camera): Promise<void> {
    this.bloomConfig = await loadDevRenderBloomConfig();
    await preloadVfxTextures(host.scene);
    this.bloomPipeline.attach(host.scene, camera, this.bloomConfig);
  }

  applyEmissiveBloomToMeshes(meshes: readonly AbstractMesh[]): void {
    applyMeshEmissiveBloomStrength(meshes, this.bloomConfig.emissive.strength);
  }

  getBloomConfig(): SceneBloomConfig {
    return this.bloomConfig;
  }

  dispose(): void {
    this.bloomPipeline.dispose();
  }
}
