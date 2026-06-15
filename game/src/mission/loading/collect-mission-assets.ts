import type { AssetManifest, ShipManifestEntry } from "@rogue-leader/engine";
import type { WeaponsManifest } from "../../data/config/weapons-manifest";
import { resolveWeaponDefinitionEntry } from "../../data/config/weapons-manifest";
import { collectShipWeaponIds, resolveShipWeaponsConfig } from "../../data/config/ship-weapons-config";
import type { MissionConfig } from "../mission-types";
import { ShipAudioCatalog } from "../../audio/ship-audio-map";
import { SfxClipIds } from "../../data/constants/audio-clips";
import { resolveShipSfoilSfx } from "../../audio/sfoil-sfx";
import { resolveFaction } from "../../combat/faction";
import { collectSelectableShipIds } from "../spawn/selectable-ships";

export interface SfoilFileVariantSet {
  basePath: string;
  files: readonly string[];
}

export interface MissionAssetPlan {
  shipIds: readonly string[];
  asteroidPrefabId?: string;
  skyboxId: string;
  skyboxTexture?: number | string;
  musicId: string;
  musicSetId?: string;
  audioClipIds: readonly string[];
  sfoilFileVariants: readonly SfoilFileVariantSet[];
}

export function collectMissionShipIds(config: {
  player: { shipId: string };
  waves: { enemies: { shipId: string }[] }[];
}): string[] {
  const ids = new Set<string>([config.player.shipId]);
  for (const wave of config.waves) {
    for (const enemy of wave.enemies) {
      ids.add(enemy.shipId);
    }
  }
  return [...ids];
}

export function collectMissionAssetPlan(
  config: MissionConfig,
  manifest: AssetManifest,
  weaponsManifest: WeaponsManifest,
): MissionAssetPlan {
  const shipIds = collectMissionShipIds(config);
  for (const shipId of collectSelectableShipIds(manifest)) {
    shipIds.push(shipId);
  }
  const uniqueShipIds = [...new Set(shipIds)];
  const clipIds = new Set<string>([
    SfxClipIds.BulletHit,
    SfxClipIds.BulletWhoosh,
    SfxClipIds.FighterExplosion,
    SfxClipIds.AsteroidExplosion,
    SfxClipIds.ShipCrash,
    SfxClipIds.MissileHit,
    SfxClipIds.ProtonTorpedoFire,
    SfxClipIds.WarheadWhoosh,
    SfxClipIds.RebelCannonFire,
    SfxClipIds.ImperialCannonFire,
  ]);

  const sfoilVariantMap = new Map<string, SfoilFileVariantSet>();

  for (const shipId of shipIds) {
    clipIds.add(ShipAudioCatalog.engineClipForShip(shipId));
    const inbound = ShipAudioCatalog.inboundClipForShip(shipId);
    if (inbound) clipIds.add(inbound);

    const entry = manifest.ships[shipId];
    if (!entry) continue;

    const faction = resolveFaction(entry.faction);
    clipIds.add(ShipAudioCatalog.cannonFireClipForFaction(faction));
    collectWeaponClips(entry, weaponsManifest, clipIds);

    const sfoilSfx = resolveShipSfoilSfx(entry.abilities?.sfoil?.sfx);
    if (sfoilSfx?.kind === "clip") {
      clipIds.add(sfoilSfx.clipId);
    } else if (sfoilSfx?.kind === "clips") {
      for (const id of sfoilSfx.clipIds) clipIds.add(id);
    } else if (sfoilSfx?.kind === "files") {
      const key = `${sfoilSfx.basePath}|${sfoilSfx.files.join(",")}`;
      sfoilVariantMap.set(key, {
        basePath: sfoilSfx.basePath,
        files: sfoilSfx.files,
      });
    }
  }

  if (config.musicSetId) {
    // Music stems warmed via warmMissionAudio music track registry.
  }

  return {
    shipIds: uniqueShipIds,
    asteroidPrefabId: config.asteroids?.prefabId,
    skyboxId: config.skyboxId,
    skyboxTexture: config.skyboxTexture,
    musicId: config.musicId,
    musicSetId: config.musicSetId,
    audioClipIds: [...clipIds],
    sfoilFileVariants: [...sfoilVariantMap.values()],
  };
}

function collectWeaponClips(
  entry: ShipManifestEntry,
  weaponsManifest: WeaponsManifest,
  clipIds: Set<string>,
): void {
  for (const weaponId of collectShipWeaponIds(entry)) {
    const def = resolveWeaponDefinitionEntry(
      weaponsManifest,
      weaponId,
      resolveShipWeaponsConfig(entry),
    );
    if (def?.audio?.fire) clipIds.add(def.audio.fire);
    if (def?.audio?.hit) clipIds.add(def.audio.hit);
  }
}
