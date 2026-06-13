import type { AssetManifest, AudioManager, GltfShipLoader, LoadedEntity } from '@rogue-leader/engine';
import { SkyboxLoader, preloadVfxTextures, setLoadedEntityVisible } from '@rogue-leader/engine';
import type { Scene } from '@babylonjs/core';
import type { WeaponsManifest } from '../config/weapons-manifest';
import type { MissionConfig } from '../missions/mission-types';
import type { WreckDebrisManager } from '../vfx/wreck-debris-manager';
import { collectMissionAssetPlan } from './collect-mission-assets';
import { ShipTemplatePool } from './ship-template-pool';

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
  private meteorTemplates: LoadedEntity[] = [];

  async preloadAll(ctx: MissionPreloadContext): Promise<void> {
    const plan = collectMissionAssetPlan(ctx.config, ctx.manifest, ctx.weaponsManifest);
    ctx.onMessage?.('Preloading ships…');

    const shipPromise = this.shipPool.preload(plan.shipIds, ctx.manifest, ctx.shipLoader);
    const wreckPromise = ctx.wreckDebris.preload(plan.shipIds, ctx.manifest);

    ctx.onMessage?.('Preloading audio…');
    for (const variant of plan.sfoilFileVariants) {
      ctx.audio.preloadFileVariants(variant.basePath, [...variant.files]);
    }
    const audioPromise = ctx.audio.warmMissionAudio({
      audioClipIds: plan.audioClipIds,
      musicId: plan.musicId,
      musicSetId: plan.musicSetId,
    });

    ctx.onMessage?.('Preloading VFX…');
    const vfxPromise = preloadVfxTextures(ctx.scene);

    let meteorPromise: Promise<void> = Promise.resolve();
    if (plan.meteorPrefabId) {
      const meteorEntry = ctx.manifest.props[plan.meteorPrefabId];
      if (meteorEntry) {
        ctx.onMessage?.('Preloading meteors…');
        meteorPromise = ctx.shipLoader
          .loadPropVariantTemplates(plan.meteorPrefabId, meteorEntry)
          .then((templates) => {
            for (const template of templates) {
              setLoadedEntityVisible(template, false);
            }
            this.meteorTemplates = templates;
          });
      }
    }

    ctx.onMessage?.('Preloading skybox…');
    const sky = ctx.manifest.skyboxes[plan.skyboxId];
    const skyPromise = sky
      ? SkyboxLoader.apply(ctx.scene, sky, '/assets')
      : Promise.resolve(SkyboxLoader.applyFallback(ctx.scene));

    await Promise.all([
      shipPromise,
      wreckPromise,
      audioPromise,
      vfxPromise,
      meteorPromise,
      skyPromise,
    ]);
  }

  getMeteorTemplates(): readonly LoadedEntity[] {
    return this.meteorTemplates;
  }

  dispose(): void {
    this.shipPool.dispose();
    for (const template of this.meteorTemplates) {
      if (!template.root.isDisposed()) {
        template.root.dispose();
      }
    }
    this.meteorTemplates = [];
  }
}
