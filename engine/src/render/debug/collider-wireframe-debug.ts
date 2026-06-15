import {
  Color3,
  Color4,
  Mesh,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type Material,
} from '@babylonjs/core';
import {
  configureColliderMesh,
  detectColliderMeshes,
  hasColliderGeometry,
  isVisualColliderMesh,
} from '../../loaders/collider-mesh-detector';
import type { LoadedEntity } from '../../loaders/gltf-ship-loader';

interface ColliderWireDebugState {
  savedMaterial: Material | null;
  savedVisibility: number;
  savedIsVisible: boolean;
  isVisual: boolean;
  edgesOn?: boolean;
  debugMaterial?: StandardMaterial;
}

const META_KEY = 'colliderWireDebug';

export const DEV_HIERARCHY_COLLIDER_WIRE_COLOR = new Color3(0.35, 0.95, 0.55);

function readState(mesh: AbstractMesh): ColliderWireDebugState {
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

function ensureNodeHierarchyEnabled(mesh: AbstractMesh): void {
  let current: AbstractMesh | TransformNode | null = mesh;
  while (current) {
    current.setEnabled(true);
    current = current.parent as TransformNode | null;
  }
}

function enableColliderWireframe(mesh: AbstractMesh, color: Color3): void {
  if (!hasColliderGeometry(mesh)) return;
  ensureNodeHierarchyEnabled(mesh);
  mesh.setEnabled(true);
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

function disableColliderWireframe(mesh: AbstractMesh): void {
  if (!hasColliderGeometry(mesh)) return;

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
  if (mesh instanceof Mesh) {
    configureColliderMesh(mesh);
  }
}

/** Show or hide a single collider mesh using the debug wireframe style. */
export function setColliderMeshWireframeVisible(
  mesh: AbstractMesh,
  visible: boolean,
  color: Color3 = DEV_HIERARCHY_COLLIDER_WIRE_COLOR,
): void {
  if (visible) {
    enableColliderWireframe(mesh, color);
  } else {
    disableColliderWireframe(mesh);
    mesh.setEnabled(false);
  }
}

/** Drop stale debug overlay state left on pooled ship collider meshes. */
export function clearMeshColliderWireDebug(mesh: AbstractMesh): void {
  const state = mesh.metadata?.[META_KEY] as ColliderWireDebugState | undefined;
  if (!state) return;

  if (state.isVisual) {
    if (state.edgesOn) {
      mesh.disableEdgesRendering();
    }
  } else {
    mesh.material = state.savedMaterial;
    mesh.isVisible = state.savedIsVisible;
    mesh.visibility = state.savedVisibility;
    if (mesh instanceof Mesh) {
      configureColliderMesh(mesh);
    }
  }

  const meta = { ...(mesh.metadata ?? {}) };
  delete meta[META_KEY];
  mesh.metadata = Object.keys(meta).length > 0 ? meta : null;
}

/** Clear wire debug metadata on every collider mesh under a loaded entity. */
export function clearLoadedEntityWireDebugMetadata(loaded: LoadedEntity): void {
  const seen = new Set<AbstractMesh>();
  for (const mesh of loaded.colliderMeshes) {
    seen.add(mesh);
    clearMeshColliderWireDebug(mesh);
  }
  for (const mesh of detectColliderMeshes(loaded.root)) {
    if (!seen.has(mesh)) {
      clearMeshColliderWireDebug(mesh);
    }
  }
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
          if (!hasColliderGeometry(mesh)) continue;
          keep.add(mesh);
          enableColliderWireframe(mesh, color);
        }
      }
    }

    for (const mesh of this.activeMeshes) {
      if (!keep.has(mesh)) {
        disableColliderWireframe(mesh);
      }
    }

    this.activeMeshes.clear();
    for (const mesh of keep) {
      this.activeMeshes.add(mesh);
    }

    if (!enabled) {
      for (const mesh of [...this.activeMeshes]) {
        disableColliderWireframe(mesh);
      }
      this.activeMeshes.clear();
    }
  }

  dispose(): void {
    for (const mesh of this.activeMeshes) {
      disableColliderWireframe(mesh);
    }
    this.activeMeshes.clear();
  }
}
