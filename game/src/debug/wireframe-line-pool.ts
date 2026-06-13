import { Color3, MeshBuilder, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';

/** Reuses updatable Babylon line systems for vector/path debug overlays. */
export class WireframeLinePool {
  private readonly meshes = new Map<string, LinesMesh>();

  set(
    scene: Scene,
    key: string,
    lines: Vector3[][],
    color: Color3,
    activeKeys: Set<string>,
  ): void {
    activeKeys.add(key);

    if (lines.length === 0) {
      const existing = this.meshes.get(key);
      existing?.setEnabled(false);
      return;
    }

    let mesh = this.meshes.get(key);
    if (!mesh || mesh.isDisposed()) {
      mesh = MeshBuilder.CreateLineSystem(
        key,
        { lines, updatable: true },
        scene,
      );
      mesh.color = color.clone();
      mesh.isPickable = false;
      this.meshes.set(key, mesh);
      return;
    }

    mesh.setEnabled(true);
    mesh.color = color;
    MeshBuilder.CreateLineSystem(key, { lines, instance: mesh });
  }

  releaseUnused(activeKeys: Set<string>): void {
    for (const [key, mesh] of this.meshes) {
      if (activeKeys.has(key)) continue;
      mesh.dispose();
      this.meshes.delete(key);
    }
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }
    this.meshes.clear();
  }
}
