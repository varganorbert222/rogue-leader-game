import {
  Color3,
  Color4,
  CubeTexture,
  MeshBuilder,
  Observer,
  ParticleSystem,
  PhotoDome,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import type {
  SkyboxCubemapEntry,
  SkyboxManifestEntry,
  SkyboxPhotodomeEntry,
} from "../loaders/asset-manifest";

export interface SkyboxApplyOptions {
  /** Photodome only: 0-based index or filename/path fragment to select a texture. */
  texture?: number | string;
}

const SKY_NODE_NAME = "mission_sky";

const skyFollowObservers = new WeakMap<Scene, Observer<Scene>>();

export class SkyboxLoader {
  static async apply(
    scene: Scene,
    entry: SkyboxManifestEntry,
    baseUrl: string,
    options?: SkyboxApplyOptions,
  ): Promise<void> {
    SkyboxLoader.disposeExisting(scene);

    if (entry.type === "photodome") {
      await SkyboxLoader.applyPhotodome(scene, entry, baseUrl, options);
    } else {
      await SkyboxLoader.applyCubemap(scene, entry, baseUrl);
    }

    SkyboxLoader.attachCameraFollow(scene);
  }

  static applyFallback(scene: Scene): void {
    SkyboxLoader.disposeExisting(scene);
    scene.clearColor.set(0.04, 0.07, 0.15, 1);
    const skybox = MeshBuilder.CreateBox(
      SKY_NODE_NAME,
      { size: 100000 },
      scene,
    );
    skybox.isPickable = false;
    skybox.infiniteDistance = true;

    const ps = new ParticleSystem("stars", 800, scene);
    ps.particleTexture = new Texture(
      "https://assets.babylonjs.com/textures/flare.png",
      scene,
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

    SkyboxLoader.attachCameraFollow(scene);
  }

  private static disposeExisting(scene: Scene): void {
    SkyboxLoader.detachCameraFollow(scene);

    scene.getNodeByName(SKY_NODE_NAME)?.dispose();
    scene.getMeshByName("skybox")?.dispose();
    scene.getMaterialByName("skyboxMat")?.dispose();

    const stars = scene.particleSystems?.find((ps) => ps.name === "stars");
    stars?.stop();
    stars?.dispose();
  }

  private static async applyCubemap(
    scene: Scene,
    entry: SkyboxCubemapEntry,
    baseUrl: string,
  ): Promise<void> {
    let texture: CubeTexture;
    try {
      const faces = entry.faces.map((face) => `${baseUrl}/${face}`);
      texture = CubeTexture.CreateFromImages(faces, scene);
    } catch {
      console.warn("[Skybox] cubemap missing — using fallback color + stars");
      SkyboxLoader.applyFallback(scene);
      return;
    }

    const skybox = MeshBuilder.CreateBox(
      SKY_NODE_NAME,
      { size: 100000 },
      scene,
    );
    skybox.isPickable = false;
    skybox.infiniteDistance = true;
    const mat = new StandardMaterial("skyboxMat", scene);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    mat.diffuseColor = Color3.Black();
    mat.reflectionTexture = texture;
    skybox.material = mat;
  }

  private static async applyPhotodome(
    scene: Scene,
    entry: SkyboxPhotodomeEntry,
    baseUrl: string,
    options?: SkyboxApplyOptions,
  ): Promise<void> {
    const relativePath = SkyboxLoader.resolvePhotodomeTexture(entry, options);
    if (!relativePath) {
      console.warn("[Skybox] photodome has no textures — using fallback");
      SkyboxLoader.applyFallback(scene);
      return;
    }

    const url = `${baseUrl}/${relativePath}`;

    try {
      await new Promise<void>((resolve, reject) => {
        const dome = new PhotoDome(
          SKY_NODE_NAME,
          url,
          {
            resolution: entry.resolution ?? 32,
            size: entry.size ?? 5000,
            useDirectMapping: entry.useDirectMapping ?? true,
          },
          scene,
        );
        dome.mesh.isPickable = false;
        dome.mesh.infiniteDistance = true;

        const onReady = dome.onLoadObservable.add(() => {
          dome.onLoadObservable.remove(onReady);
          dome.onLoadErrorObservable.remove(onError);
          resolve();
        });
        const onError = dome.onLoadErrorObservable.add(() => {
          dome.onLoadObservable.remove(onReady);
          dome.onLoadErrorObservable.remove(onError);
          reject(new Error(`photodome failed: ${url}`));
        });
      });
    } catch {
      console.warn(
        `[Skybox] photodome missing (${url}) — using fallback color + stars`,
      );
      SkyboxLoader.applyFallback(scene);
    }
  }

  private static resolvePhotodomeTexture(
    entry: SkyboxPhotodomeEntry,
    options?: SkyboxApplyOptions,
  ): string | undefined {
    const textures = entry.textures;
    if (textures.length === 0) return undefined;

    if (typeof options?.texture === "number") {
      const index = Math.floor(options.texture);
      return textures[index] ?? textures[0];
    }

    if (typeof options?.texture === "string") {
      const needle = options.texture.toLowerCase();
      const match = textures.find(
        (path) =>
          path.toLowerCase() === needle ||
          path.toLowerCase().endsWith(`/${needle}`) ||
          path.toLowerCase().includes(needle),
      );
      if (match) return match;
    }

    if (textures.length === 1) {
      return textures[0];
    }

    return textures[Math.floor(Math.random() * textures.length)];
  }

  /** Keep sky geometry centered on the active camera (infiniteDistance alone is not enough). */
  private static attachCameraFollow(scene: Scene): void {
    SkyboxLoader.detachCameraFollow(scene);
    SkyboxLoader.syncSkyToCamera(scene);

    const observer = scene.onBeforeRenderObservable.add(() => {
      SkyboxLoader.syncSkyToCamera(scene);
    });
    skyFollowObservers.set(scene, observer);
  }

  private static detachCameraFollow(scene: Scene): void {
    const observer = skyFollowObservers.get(scene);
    if (!observer) return;
    scene.onBeforeRenderObservable.remove(observer);
    skyFollowObservers.delete(scene);
  }

  private static syncSkyToCamera(scene: Scene): void {
    const camera = scene.activeCamera;
    if (!camera) return;

    const camPos = camera.globalPosition;
    const sky = scene.getTransformNodeByName(SKY_NODE_NAME);
    if (sky) {
      sky.position.copyFrom(camPos);
    }

    const stars = scene.particleSystems?.find((ps) => ps.name === "stars");
    if (!stars) return;

    if (stars.emitter instanceof Vector3) {
      stars.emitter.copyFrom(camPos);
      return;
    }

    stars.emitter = camPos.clone();
  }
}
