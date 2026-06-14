import {
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Vector3,
  type AbstractEngine,
} from '@babylonjs/core';
import { createGraphicsEngine, type GraphicsBackend } from './backend';
import { AudioManager } from '../audio/audio-manager';
import { RuntimePaths } from '../runtime-paths';

export class BabylonHost {
  readonly engine: AbstractEngine;
  readonly backend: GraphicsBackend;
  readonly scene: Scene;
  readonly audio: AudioManager;
  private readonly teardown: (() => void)[] = [];

  private constructor(
    engine: AbstractEngine,
    backend: GraphicsBackend,
    scene: Scene,
    audio: AudioManager
  ) {
    this.engine = engine;
    this.backend = backend;
    this.scene = scene;
    this.audio = audio;
  }

  static async create(canvas: HTMLCanvasElement): Promise<BabylonHost> {
    const { engine, backend } = await createGraphicsEngine(canvas);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.05, 0.12, 1);
    scene.blockMaterialDirtyMechanism = true;

    new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.6;
    const dir = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
    dir.intensity = 1.1;

    const audio = new AudioManager(scene);
    await audio.loadManifest(
      RuntimePaths.audioManifest,
      RuntimePaths.assetsBase,
      RuntimePaths.audioConfigBase,
    );

    const host = new BabylonHost(engine, backend, scene, audio);

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    host.teardown.push(() => window.removeEventListener('resize', onResize));

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    host.teardown.push(() => ro.disconnect());

    return host;
  }

  startRenderLoop(onUpdate: (dt: number) => void): void {
    this.engine.runRenderLoop(() => {
      onUpdate(this.engine.getDeltaTime() / 1000);
      this.scene.render();
    });
  }

  stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }

  dispose(): void {
    this.stopRenderLoop();
    this.audio.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this.teardown.forEach((fn) => fn());
    this.teardown.length = 0;
  }
}
