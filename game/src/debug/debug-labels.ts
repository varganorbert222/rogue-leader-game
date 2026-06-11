import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';

export type DebugLabelCategory =
  | 'vehicle'
  | 'projectile'
  | 'navWaypoint'
  | 'navPath'
  | 'wanderZone'
  | 'meteor'
  | 'npc';

const CATEGORY_COLORS: Record<DebugLabelCategory, Color3> = {
  vehicle: new Color3(0.35, 0.85, 1),
  projectile: new Color3(1, 0.75, 0.2),
  navWaypoint: new Color3(0.45, 0.95, 0.55),
  navPath: new Color3(0.35, 0.75, 1),
  wanderZone: new Color3(0.7, 0.45, 1),
  meteor: new Color3(0.85, 0.55, 0.35),
  npc: new Color3(1, 0.45, 0.45),
};

const CATEGORY_PREFIX: Record<DebugLabelCategory, string> = {
  vehicle: 'VEH',
  projectile: 'PRJ',
  navWaypoint: 'WP',
  navPath: 'PATH',
  wanderZone: 'ZONE',
  meteor: 'MTR',
  npc: 'NPC',
};

export interface DebugLabelSpec {
  id: string;
  category: DebugLabelCategory;
  text: string;
  position: Vector3;
  /** Billboard marker shape scale. */
  markerScale?: number;
}

/** Billboard text + category marker gizmo. */
export class DebugLabelGizmo {
  private readonly root: Mesh;
  private readonly labelPlane: Mesh;
  private readonly marker: Mesh;
  private readonly texture: DynamicTexture;
  private readonly material: StandardMaterial;

  constructor(scene: Scene, spec: DebugLabelSpec) {
    const color = CATEGORY_COLORS[spec.category];
    const prefix = CATEGORY_PREFIX[spec.category];

    this.root = MeshBuilder.CreateBox(`dbgLblRoot_${spec.id}`, { size: 0.01 }, scene);
    this.root.isPickable = false;
    this.root.position.copyFrom(spec.position);

    this.marker = this.createCategoryMarker(scene, spec.id, spec.category, spec.markerScale ?? 3);
    this.marker.parent = this.root;

    this.labelPlane = MeshBuilder.CreatePlane(
      `dbgLblPlane_${spec.id}`,
      { width: 8, height: 2.2 },
      scene
    );
    this.labelPlane.parent = this.root;
    this.labelPlane.position.y = 4;
    this.labelPlane.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;

    this.texture = new DynamicTexture(
      `dbgLblTex_${spec.id}`,
      { width: 384, height: 96 },
      scene,
      false
    );
    this.material = new StandardMaterial(`dbgLblMat_${spec.id}`, scene);
    this.material.diffuseTexture = this.texture;
    this.material.emissiveColor = color;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    this.labelPlane.material = this.material;

    this.setText(`${prefix} ${spec.text}`);
  }

  setPosition(position: Vector3): void {
    this.root.position.copyFrom(position);
  }

  setText(text: string): void {
    const color = this.material.emissiveColor;
    this.texture.clear();
    this.texture.drawText(
      text,
      null,
      52,
      'bold 28px Consolas, monospace',
      color3ToHex(color),
      'rgba(0,0,0,0.55)',
      true
    );
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.marker.dispose();
    this.labelPlane.dispose();
    this.root.dispose();
  }

  private createCategoryMarker(
    scene: Scene,
    id: string,
    category: DebugLabelCategory,
    scale: number
  ): Mesh {
    const color = CATEGORY_COLORS[category];
    let mesh: Mesh;
    switch (category) {
      case 'vehicle':
        mesh = MeshBuilder.CreateBox(`dbgMrk_${id}`, { width: scale, height: scale * 0.4, depth: scale * 1.2 }, scene);
        break;
      case 'projectile':
        mesh = MeshBuilder.CreateCylinder(`dbgMrk_${id}`, { diameter: scale * 0.35, height: scale }, scene);
        break;
      case 'navWaypoint':
        mesh = MeshBuilder.CreateSphere(`dbgMrk_${id}`, { diameter: scale * 0.6 }, scene);
        break;
      case 'navPath':
        mesh = MeshBuilder.CreateTorus(`dbgMrk_${id}`, { diameter: scale, thickness: scale * 0.12 }, scene);
        break;
      case 'wanderZone':
        mesh = MeshBuilder.CreateBox(`dbgMrk_${id}`, { size: scale * 0.65 }, scene);
        break;
      case 'meteor':
        mesh = MeshBuilder.CreateIcoSphere(`dbgMrk_${id}`, { radius: scale * 0.45 }, scene);
        break;
      case 'npc':
      default:
        mesh = MeshBuilder.CreateTorus(`dbgMrk_${id}`, {
          diameter: scale * 0.7,
          thickness: scale * 0.18,
          tessellation: 3,
        }, scene);
        break;
    }
    const mat = new StandardMaterial(`dbgMrkMat_${id}`, scene);
    mat.emissiveColor = color;
    mat.wireframe = true;
    mat.disableLighting = true;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    return mesh;
  }
}

function color3ToHex(color: Color3): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(color.r)}${c(color.g)}${c(color.b)}`;
}

export class DebugLabelLayer {
  private gizmos: DebugLabelGizmo[] = [];

  render(scene: Scene, specs: DebugLabelSpec[]): void {
    this.clear();
    for (const spec of specs) {
      this.gizmos.push(new DebugLabelGizmo(scene, spec));
    }
  }

  clear(): void {
    for (const gizmo of this.gizmos) {
      gizmo.dispose();
    }
    this.gizmos = [];
  }
}
