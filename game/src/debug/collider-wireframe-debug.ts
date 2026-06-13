import {
  Color3,
  Color4,
  Mesh,
  StandardMaterial,
  type AbstractMesh,
  type Material,
} from '@babylonjs/core';
import { configureColliderMesh, isVisualColliderMesh } from '@rogue-leader/engine';

interface ColliderWireDebugState {
  savedMaterial: Material | null;
  savedVisibility: number;
  savedIsVisible: boolean;
  isVisual: boolean;
  edgesOn?: boolean;
  debugMaterial?: StandardMaterial;
}

const META_KEY = 'colliderWireDebug';

function readState(mesh: Mesh): ColliderWireDebugState {
  const existing = mesh.metadata?.[META_KEY] as ColliderWireDebugState | undefined;
  if (existing) return existing;

  const state: ColliderWireDebugState = {
    savedMaterial: mesh.material,
    savedVisibility: mesh.visibility,
    savedIsVisible: mesh.isVisible,
    isVisual: isVisualColliderMesh(mesh),
  };
  mesh.metadata = { ...(mesh.metadata ?? {}), [META_KEY]: state };
  return state;
}

/** Toggle Babylon native wireframe / edge rendering on real collider meshes. */
export class ColliderWireframeDebug {
  private readonly activeMeshes = new Set<AbstractMesh>();

  sync(
    colliders: readonly { meshes: readonly AbstractMesh[]; isPlayer: boolean }[],
    enabled: boolean,
    colors: { player: Color3; other: Color3 },
  ): void {
    const keep = new Set<AbstractMesh>();

    if (enabled) {
      for (const collider of colliders) {
        const color = collider.isPlayer ? colors.player : colors.other;
        for (const mesh of collider.meshes) {
          if (!(mesh instanceof Mesh) || mesh.isDisposed() || !mesh.isEnabled()) continue;
          keep.add(mesh);
          this.enable(mesh, color);
        }
      }
    }

    for (const mesh of this.activeMeshes) {
      if (!keep.has(mesh)) {
        this.disable(mesh);
      }
    }

    this.activeMeshes.clear();
    for (const mesh of keep) {
      this.activeMeshes.add(mesh);
    }

    if (!enabled) {
      for (const mesh of [...this.activeMeshes]) {
        this.disable(mesh);
      }
      this.activeMeshes.clear();
    }
  }

  dispose(): void {
    for (const mesh of this.activeMeshes) {
      this.disable(mesh);
    }
    this.activeMeshes.clear();
  }

  private enable(mesh: Mesh, color: Color3): void {
    const state = readState(mesh);

    if (state.isVisual) {
      if (!state.edgesOn) {
        mesh.enableEdgesRendering(0.95);
        mesh.edgesWidth = 2;
        state.edgesOn = true;
      }
      mesh.edgesColor = new Color4(color.r, color.g, color.b, 1);
      return;
    }

    mesh.isVisible = true;
    mesh.visibility = 1;

    if (!state.debugMaterial || !state.debugMaterial.getScene()) {
      const mat = new StandardMaterial(`dbgColWire_${mesh.uniqueId}`, mesh.getScene()!);
      mat.wireframe = true;
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      state.debugMaterial = mat;
    }

    state.debugMaterial.emissiveColor = color;
    mesh.material = state.debugMaterial;
  }

  private disable(mesh: AbstractMesh): void {
    if (!(mesh instanceof Mesh) || mesh.isDisposed()) return;

    const state = mesh.metadata?.[META_KEY] as ColliderWireDebugState | undefined;
    if (!state) return;

    if (state.isVisual) {
      if (state.edgesOn) {
        mesh.disableEdgesRendering();
        state.edgesOn = false;
      }
      return;
    }

    mesh.material = state.savedMaterial;
    mesh.isVisible = state.savedIsVisible;
    mesh.visibility = state.savedVisibility;
    configureColliderMesh(mesh);
  }
}
