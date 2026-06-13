import {
  Color3,
  MeshBuilder,
  Vector3,
  type Mesh,
  type Scene,
  type TransformNode,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  TextBlock,
} from "@babylonjs/gui";

export type DebugLabelCategory =
  | "vehicle"
  | "projectile"
  | "navWaypoint"
  | "navPath"
  | "wanderZone"
  | "asteroid"
  | "npc";

const CATEGORY_COLORS: Record<DebugLabelCategory, string> = {
  vehicle: "#59d9ff",
  projectile: "#ffbf33",
  navWaypoint: "#73f28c",
  navPath: "#59bfff",
  wanderZone: "#b273ff",
  asteroid: "#d98c59",
  npc: "#ff7373",
};

const CATEGORY_PREFIX: Record<DebugLabelCategory, string> = {
  vehicle: "VEH",
  projectile: "PRJ",
  navWaypoint: "WP",
  navPath: "PATH",
  wanderZone: "ZONE",
  asteroid: "AST",
  npc: "NPC",
};

export interface DebugLabelSpec {
  id: string;
  category: DebugLabelCategory;
  text: string;
  position: Vector3;
  /** Billboard marker shape scale. */
  markerScale?: number;
}

interface DebugLabelEntry {
  anchor: TransformNode;
  text: TextBlock;
  lastText: string;
}

/** Screen-linked debug labels via a shared AdvancedDynamicTexture. */
export class DebugLabelLayer {
  private texture?: AdvancedDynamicTexture;
  private readonly entries = new Map<string, DebugLabelEntry>();

  render(scene: Scene, specs: DebugLabelSpec[]): void {
    if (!specs.length) {
      this.clear();
      return;
    }

    if (!this.texture) {
      this.texture = AdvancedDynamicTexture.CreateFullscreenUI(
        "debugLabels",
        true,
        scene,
      );
      this.texture.idealWidth = 1920;
    }

    const active = new Set<string>();

    for (const spec of specs) {
      active.add(spec.id);
      const prefix = CATEGORY_PREFIX[spec.category];
      const text = `${prefix} ${spec.text}`;
      let entry = this.entries.get(spec.id);

      if (!entry) {
        const anchor = this.createAnchor(scene, spec.id);
        const block = new TextBlock(`dbgLbl_${spec.id}`);
        block.color = CATEGORY_COLORS[spec.category];
        block.fontSize = 14;
        block.fontFamily = "Consolas, monospace";
        block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        block.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        block.width = "220px";
        block.height = "36px";
        block.alpha = 0.92;
        block.shadowColor = "rgba(0,0,0,0.65)";
        block.shadowOffsetX = 1;
        block.shadowOffsetY = 1;
        block.linkOffsetY = -28;
        this.texture.addControl(block);
        block.linkWithMesh(anchor);
        entry = { anchor, text: block, lastText: "" };
        this.entries.set(spec.id, entry);
      }

      entry.anchor.position.copyFrom(spec.position);
      if (entry.lastText !== text) {
        entry.lastText = text;
        entry.text.text = text;
        entry.text.color = CATEGORY_COLORS[spec.category];
      }
    }

    for (const [id, entry] of this.entries) {
      if (active.has(id)) continue;
      entry.text.linkWithMesh(null);
      this.texture.removeControl(entry.text);
      entry.text.dispose();
      entry.anchor.dispose();
      this.entries.delete(id);
    }
  }

  clear(): void {
    if (!this.texture) return;
    for (const entry of this.entries.values()) {
      entry.text.linkWithMesh(null);
      this.texture.removeControl(entry.text);
      entry.text.dispose();
      entry.anchor.dispose();
    }
    this.entries.clear();
    this.texture.dispose();
    this.texture = undefined;
  }

  private createAnchor(scene: Scene, id: string): Mesh {
    const anchor = MeshBuilder.CreateBox(
      `dbgLblAnchor_${id}`,
      { size: 0.01 },
      scene,
    );
    anchor.isPickable = false;
    anchor.isVisible = false;
    return anchor;
  }
}
