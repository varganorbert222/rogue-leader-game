import type { Scene, TrailMesh, TransformNode } from '@babylonjs/core';
import {
  createEngineTrail,
  DEFAULT_ENGINE_VFX,
  detectShipAnchors,
  RuntimePaths,
  type EngineVfxProfile,
} from '@rogue-leader/engine';
import type { ShipAnchors, ShipManifestEntry } from '@rogue-leader/engine';
import {
  loadWeaponsManifest,
  resolveEngineVfxProfile,
  type WeaponsManifest,
} from '../data/config/weapons-manifest';

interface EngineTrailSlot {
  trail: TrailMesh;
  anchor: TransformNode;
}

export class EngineVfxController {
  private trails: EngineTrailSlot[] = [];
  private manifest: WeaponsManifest | null = null;

  async loadManifest(url = RuntimePaths.weaponsManifest): Promise<void> {
    this.manifest = await loadWeaponsManifest(url);
  }

  attach(
    scene: Scene,
    root: TransformNode,
    shipEntry: ShipManifestEntry,
    manifest?: WeaponsManifest,
    anchors?: ShipAnchors
  ): void {
    const weaponsManifest = manifest ?? this.manifest;
    if (!weaponsManifest) return;

    this.dispose();
    const engines = anchors?.engines ?? detectShipAnchors(root).engines;
    const engineBindings = shipEntry.anchors?.engines;
    const faction = shipEntry.faction ?? 'rebel';

    for (const engine of engines) {
      const profile =
        resolveEngineVfxProfile(weaponsManifest, engine.slotId, engineBindings, faction) ??
        DEFAULT_ENGINE_VFX;
      const trail = createEngineTrail(scene, engine.node, profile);
      this.trails.push({ trail, anchor: engine.node });
    }
  }

  update(): void {
    // TrailMesh updates from its generator mesh each frame.
  }

  dispose(): void {
    for (const slot of this.trails) {
      slot.trail.material?.dispose();
      slot.trail.dispose();
    }
    this.trails = [];
  }
}

export type { EngineVfxProfile };
