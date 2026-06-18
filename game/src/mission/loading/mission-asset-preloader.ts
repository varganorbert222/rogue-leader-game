import type {
  AssetManifest,
  AudioManager,
  GltfShipLoader,
  LoadedEntity,
} from "@rogue-leader/engine";
import {
  SkyboxLoader,
  preloadVfxTextures,
  preparePropInstanceTemplate,
} from "@rogue-leader/engine";
import type { Scene } from "@babylonjs/core";
import type { WeaponsManifest } from "../../data/config/weapons-manifest";
import type { MissionConfig } from "../mission-types";
import type { WreckDebrisManager } from "../../vfx/wreck-debris-manager";
import { collectMissionAssetPlan } from "./collect-mission-assets";
import { ShipTemplatePool } from "./ship-template-pool";
import {
  BULLET_WHOOSH_BASE_PATH,
  BULLET_WHOOSH_FILES,
} from "../../audio/bullet-whoosh-sfx";

export interface MissionPreloadContext {
  config: MissionConfig;
  manifest: AssetManifest;
  weaponsManifest: WeaponsManifest;
  scene: Scene;
  shipLoader: GltfShipLoader;
  wreckDebris: WreckDebrisManager;
  audio: AudioManager;
  onMessage?: (message: string) => void;
}

export class MissionAssetPreloader {
  readonly shipPool = new ShipTemplatePool();
  private asteroidTemplates: LoadedEntity[] = [];

  async preloadAll(ctx: MissionPreloadContext): Promise<void> {
    const plan = collectMissionAssetPlan(
      ctx.config,
      ctx.manifest,
      ctx.weaponsManifest,
    );
    ctx.onMessage?.("Preloading ships…");

    const shipPromise = this.shipPool.preload(
      plan.shipIds,
      ctx.manifest,
      ctx.shipLoader,
    );
    const wreckPromise = ctx.wreckDebris.preload(plan.shipIds, ctx.manifest);

    ctx.onMessage?.("Preloading audio…");
    ctx.audio.preloadFileVariants(BULLET_WHOOSH_BASE_PATH, BULLET_WHOOSH_FILES);
    for (const variant of plan.sfoilFileVariants) {
      ctx.audio.preloadFileVariants(variant.basePath, [...variant.files]);
    }
    const audioPromise = ctx.audio.warmMissionAudio({
      audioClipIds: plan.audioClipIds,
      musicId: plan.musicId,
      musicSetId: plan.musicSetId,
    });

    ctx.onMessage?.("Preloading VFX…");
    const vfxPromise = preloadVfxTextures(ctx.scene);

    let asteroidPromise: Promise<void> = Promise.resolve();
    if (plan.asteroidPrefabId) {
      const asteroidEntry = ctx.manifest.props[plan.asteroidPrefabId];
      if (asteroidEntry) {
        ctx.onMessage?.("Preloading asteroids…");
        asteroidPromise = Promise.all([
          ctx.shipLoader
            .loadPropVariantTemplates(plan.asteroidPrefabId, asteroidEntry)
            .then((templates) => {
              for (const template of templates) {
                preparePropInstanceTemplate(template);
              }
              this.asteroidTemplates = templates;
            }),
          ctx.wreckDebris.preloadAsteroidWrecks(plan.asteroidPrefabId, ctx.manifest),
        ]).then(() => undefined);
      }
    }

    ctx.onMessage?.("Preloading skybox…");
    const sky = ctx.manifest.skyboxes[plan.skyboxId];
    const skyPromise = sky
      ? SkyboxLoader.apply(ctx.scene, sky, "/assets", {
          texture: plan.skyboxTexture,
        })
      : Promise.resolve(SkyboxLoader.applyFallback(ctx.scene));

    await Promise.all([
      shipPromise,
      wreckPromise,
      audioPromise,
      vfxPromise,
      asteroidPromise,
      skyPromise,
    ]);
  }

  getAsteroidTemplates(): readonly LoadedEntity[] {
    return this.asteroidTemplates;
  }

  dispose(): void {
    this.shipPool.dispose();
    for (const template of this.asteroidTemplates) {
      if (!template.root.isDisposed()) {
        template.root.dispose();
      }
    }
    this.asteroidTemplates = [];
  }
}
