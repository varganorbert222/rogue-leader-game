import {
  Color3,
  Color4,
  CubeTexture,
  MeshBuilder,
  ParticleSystem,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import type { SkyboxManifestEntry } from '../loaders/asset-manifest';

export class SkyboxLoader {
  static async apply(
    scene: Scene,
    entry: SkyboxManifestEntry,
    baseUrl: string
  ): Promise<void> {
    const existing = scene.getMeshByName('skybox');
    existing?.dispose();

    let texture: CubeTexture;
    try {
      const faces = entry.faces.map((f) => `${baseUrl}/${f}`);
      texture = CubeTexture.CreateFromImages(faces, scene);
    } catch {
      console.warn('[Skybox] cubemap missing — using fallback color + stars');
      SkyboxLoader.applyFallback(scene);
      return;
    }

    const skybox = MeshBuilder.CreateBox('skybox', { size: 5000 }, scene);
    skybox.isPickable = false;
    skybox.infiniteDistance = true;
    const mat = new StandardMaterial('skyboxMat', scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.reflectionTexture = texture;
    skybox.material = mat;
  }

  static applyFallback(scene: Scene): void {
    scene.clearColor.set(0.04, 0.07, 0.15, 1);
    const skybox = MeshBuilder.CreateBox('skybox', { size: 5000 }, scene);
    skybox.isPickable = false;
    skybox.infiniteDistance = true;

    const ps = new ParticleSystem('stars', 800, scene);
    ps.particleTexture = new Texture(
      'https://assets.babylonjs.com/textures/flare.png',
      scene
    );
    ps.emitter = Vector3.Zero();
    ps.minEmitBox = new Vector3(-2000, -2000, -2000);
    ps.maxEmitBox = new Vector3(2000, 2000, 2000);
    ps.color1 = new Color4(0.8, 0.9, 1, 1);
    ps.color2 = new Color4(0.5, 0.6, 0.9, 1);
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.emitRate = 0;
    ps.manualEmitCount = 800;
    ps.maxLifeTime = 99999;
    ps.start();
  }
}
