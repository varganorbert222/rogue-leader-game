import type { Camera, Scene } from "@babylonjs/core";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

export interface SceneBloomConfig {
  enabled: boolean;
  weight: number;
  threshold: number;
  kernel: number;
  scale: number;
  projectiles: { strength: number };
  emissive: { strength: number };
}

export class SceneBloomPipeline {
  private pipeline: DefaultRenderingPipeline | null = null;

  attach(scene: Scene, camera: Camera, config: SceneBloomConfig): void {
    this.dispose();

    const pipeline = new DefaultRenderingPipeline("sceneBloom", true, scene, [
      camera,
    ]);
    pipeline.imageProcessingEnabled = false;
    pipeline.fxaaEnabled = false;
    pipeline.sharpenEnabled = false;
    pipeline.depthOfFieldEnabled = false;
    pipeline.chromaticAberrationEnabled = false;
    pipeline.grainEnabled = false;
    pipeline.glowLayerEnabled = false;
    pipeline.bloomEnabled = config.enabled;
    pipeline.bloomWeight = config.weight;
    pipeline.bloomThreshold = config.threshold;
    pipeline.bloomKernel = config.kernel;
    pipeline.bloomScale = config.scale;
    this.pipeline = pipeline;
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
  }
}
