import {
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
  type Scene,
} from '@babylonjs/core';

function colorKey(color: Color3): string {
  return `${color.r.toFixed(3)}_${color.g.toFixed(3)}_${color.b.toFixed(3)}`;
}

type ShapeKind = 'sphere' | 'box' | 'cylinder';

/** Pooled unit primitives drawn with Babylon's native `material.wireframe`. */
export class WireframeShapePool {
  private readonly shapes = new Map<string, Mesh>();
  private readonly materials = new Map<string, StandardMaterial>();

  setSphere(
    scene: Scene,
    key: string,
    center: Vector3,
    radius: number,
    color: Color3,
    activeKeys: Set<string>,
  ): void {
    const mesh = this.ensureShape(scene, key, 'sphere', color, activeKeys);
    mesh.rotationQuaternion = null;
    mesh.rotation.setAll(0);
    mesh.position.copyFrom(center);
    mesh.scaling.setAll(Math.max(radius, 0.01));
  }

  setBox(
    scene: Scene,
    key: string,
    center: Vector3,
    halfExtents: Vector3,
    color: Color3,
    activeKeys: Set<string>,
  ): void {
    const mesh = this.ensureShape(scene, key, 'box', color, activeKeys);
    mesh.rotationQuaternion = null;
    mesh.rotation.setAll(0);
    mesh.position.copyFrom(center);
    mesh.scaling.set(
      Math.max(halfExtents.x, 0.01),
      Math.max(halfExtents.y, 0.01),
      Math.max(halfExtents.z, 0.01),
    );
  }

  /** Oriented line segment (unit box scaled along the segment). */
  setLine(
    scene: Scene,
    key: string,
    from: Vector3,
    to: Vector3,
    thickness: number,
    color: Color3,
    activeKeys: Set<string>,
  ): void {
    const mesh = this.ensureShape(scene, key, 'box', color, activeKeys);
    const delta = to.subtract(from);
    const length = delta.length();
    if (length < 0.001) {
      mesh.setEnabled(false);
      return;
    }

    const midpoint = from.add(to).scale(0.5);
    const t = Math.max(thickness, 0.02);
    mesh.position.copyFrom(midpoint);
    mesh.scaling.set(t, t, length * 0.5);
    mesh.rotationQuaternion = Quaternion.FromLookDirectionLH(
      delta.normalize(),
      Vector3.Up(),
    );
  }

  /** Oriented cylinder between two points. */
  setCylinder(
    scene: Scene,
    key: string,
    from: Vector3,
    to: Vector3,
    radius: number,
    color: Color3,
    activeKeys: Set<string>,
  ): void {
    const mesh = this.ensureShape(scene, key, 'cylinder', color, activeKeys);
    const delta = to.subtract(from);
    const length = delta.length();
    if (length < 0.001) {
      mesh.setEnabled(false);
      return;
    }

    const midpoint = from.add(to).scale(0.5);
    const r = Math.max(radius, 0.02);
    mesh.position.copyFrom(midpoint);
    mesh.scaling.set(r, r, length * 0.5);
    mesh.rotationQuaternion = Quaternion.FromLookDirectionLH(
      delta.normalize(),
      Vector3.Up(),
    );
  }

  releaseUnused(activeKeys: Set<string>): void {
    for (const [key, mesh] of this.shapes) {
      if (activeKeys.has(key)) continue;
      mesh.dispose();
      this.shapes.delete(key);
    }
  }

  dispose(): void {
    for (const mesh of this.shapes.values()) {
      mesh.dispose();
    }
    this.shapes.clear();
    for (const material of this.materials.values()) {
      material.dispose();
    }
    this.materials.clear();
  }

  private ensureShape(
    scene: Scene,
    key: string,
    kind: ShapeKind,
    color: Color3,
    activeKeys: Set<string>,
  ): Mesh {
    activeKeys.add(key);

    const existing = this.shapes.get(key);
    const needsRecreate =
      !existing ||
      existing.isDisposed() ||
      (existing.metadata?.debugWireShapeKind as ShapeKind | undefined) !== kind;

    if (needsRecreate) {
      existing?.dispose();
      const created =
        kind === 'sphere'
          ? MeshBuilder.CreateSphere(key, { diameter: 2, segments: 12 }, scene)
          : kind === 'cylinder'
            ? MeshBuilder.CreateCylinder(key, { height: 2, diameter: 2 }, scene)
            : MeshBuilder.CreateBox(key, { size: 2 }, scene);
      created.isPickable = false;
      created.metadata = { ...(created.metadata ?? {}), debugWireShapeKind: kind };
      this.shapes.set(key, created);
    }

    const instance = this.shapes.get(key)!;
    instance.setEnabled(true);
    instance.material = this.materialFor(scene, color);
    return instance;
  }

  private materialFor(scene: Scene, color: Color3): StandardMaterial {
    const key = colorKey(color);
    let material = this.materials.get(key);
    if (!material || !material.getScene()) {
      material = new StandardMaterial(`dbgWire_${key}`, scene);
      material.wireframe = true;
      material.emissiveColor = color.clone();
      material.disableLighting = true;
      material.backFaceCulling = false;
      this.materials.set(key, material);
    }
    return material;
  }
}
