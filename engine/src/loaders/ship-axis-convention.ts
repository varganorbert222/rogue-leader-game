import { Matrix, Quaternion, Vector3, type TransformNode } from '@babylonjs/core';

/** Model-space axis identifier (Blender / glTF object space). */
export type AxisId = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface ShipAxisConventionConfig {
  /** Exported model nose direction in file space. Default: +Z. */
  forward: AxisId;
  /** Exported model starboard direction in file space. Default: +X. */
  right: AxisId;
  /** Exported model up direction. Optional — derived from forward × right if omitted. */
  up?: AxisId;
  /** Mirror mesh on this model-space axis (negative scale). Applied before axis alignment. */
  mirror?: AxisId;
  /** Invert cosmetic roll on the visual bank pivot (forward / nose axis). */
  invertForwardRoll?: boolean;
}

export interface ShipVisualOptions {
  invertForwardRoll: boolean;
}

export const DEFAULT_SHIP_AXIS_CONFIG: ShipAxisConventionConfig = {
  forward: '+z',
  right: '+x',
};

export function axisIdToVector(axis: AxisId): Vector3 {
  switch (axis) {
    case '+x':
      return Vector3.Right();
    case '-x':
      return Vector3.Left();
    case '+y':
      return Vector3.Up();
    case '-y':
      return Vector3.Down();
    case '+z':
      return Vector3.Forward();
    case '-z':
      return Vector3.Backward();
  }
}

export function resolveShipAxisConfig(
  partial?: Partial<ShipAxisConventionConfig>
): ShipAxisConventionConfig {
  return {
    forward: partial?.forward ?? DEFAULT_SHIP_AXIS_CONFIG.forward,
    right: partial?.right ?? DEFAULT_SHIP_AXIS_CONFIG.right,
    up: partial?.up,
    mirror: partial?.mirror,
    invertForwardRoll: partial?.invertForwardRoll ?? false,
  };
}

export function resolveShipVisualOptions(
  partial?: Partial<ShipAxisConventionConfig>
): ShipVisualOptions {
  return {
    invertForwardRoll: partial?.invertForwardRoll ?? false,
  };
}

function applyMirrorScale(node: TransformNode, mirror?: AxisId): void {
  if (!mirror) return;

  const axis = axisIdToVector(mirror);
  const scale = node.scaling.clone();
  const magnitude = (v: number) => (Math.abs(v) > 1e-6 ? Math.abs(v) : 1);

  if (Math.abs(axis.x) > 0.5) scale.x = -magnitude(scale.x);
  if (Math.abs(axis.y) > 0.5) scale.y = -magnitude(scale.y);
  if (Math.abs(axis.z) > 0.5) scale.z = -magnitude(scale.z);

  node.scaling.copyFrom(scale);
}

const ORTHO_EPS = 0.05;

function isOrthogonal(a: Vector3, b: Vector3): boolean {
  return Math.abs(Vector3.Dot(a, b)) <= ORTHO_EPS;
}

function isOrthogonalBasis(forward: Vector3, right: Vector3, up: Vector3): boolean {
  return isOrthogonal(forward, right) && isOrthogonal(forward, up) && isOrthogonal(right, up);
}

function buildModelBasis(
  config: ShipAxisConventionConfig
): { forward: Vector3; right: Vector3; up: Vector3 } | null {
  const forward = axisIdToVector(config.forward).normalize();

  if (config.up !== undefined) {
    const up = axisIdToVector(config.up).normalize();

    if (isOrthogonal(forward, up)) {
      const right = axisIdToVector(config.right).normalize();
      if (isOrthogonalBasis(forward, right, up)) {
        return { forward, right, up };
      }
      if (!isOrthogonal(forward, right)) {
        console.warn(
          `[ModelAxis] forward (${config.forward}) and right (${config.right}) are not perpendicular — deriving right from up × forward`
        );
      } else {
        console.warn(
          `[ModelAxis] up (${config.up}) does not match forward × right — deriving right from up × forward`
        );
      }
      const derivedRight = Vector3.Cross(up, forward);
      if (derivedRight.lengthSquared() < 1e-4) {
        return null;
      }
      return { forward, right: derivedRight.normalize(), up };
    }

    console.warn(
      `[ModelAxis] forward (${config.forward}) and up (${config.up}) are parallel — using defaults +z / +x / +y`
    );
    return null;
  }

  const right = axisIdToVector(config.right).normalize();
  if (!isOrthogonal(forward, right)) {
    return null;
  }

  const up = Vector3.Cross(forward, right).normalize();
  return { forward, right, up };
}

/**
 * Static rotation applied to the visual pivot only.
 * Maps exported model axes → engine canonical (+X right, +Y up, +Z forward).
 * Does not affect physics, flight input, camera, or AI.
 */
export class ModelAxisCorrection {
  private readonly correction: Quaternion;

  constructor(config: Partial<ShipAxisConventionConfig> = DEFAULT_SHIP_AXIS_CONFIG) {
    const resolved = resolveShipAxisConfig(config);
    const basis = buildModelBasis(resolved);

    let forwardLocal = Vector3.Forward();
    let rightLocal = Vector3.Right();
    let upLocal = Vector3.Up();

    if (basis) {
      forwardLocal = basis.forward;
      rightLocal = basis.right;
      upLocal = basis.up;
    } else if (resolved.up === undefined) {
      console.warn(
        `[ModelAxis] forward (${resolved.forward}) and right (${resolved.right}) are not perpendicular — using defaults +z / +x`
      );
    }

    const localBasis = basisMatrix(rightLocal, upLocal, forwardLocal);
    const localBasisInv = Matrix.Invert(localBasis);
    const canonical = basisMatrix(Vector3.Right(), Vector3.Up(), Vector3.Forward());
    this.correction = Quaternion.FromRotationMatrix(
      canonical.multiply(localBasisInv)
    ).normalize();
  }

  /** Local rotation for `visualRoot` (meshes + anchor empties under visual). */
  getVisualCorrectionQuaternion(): Quaternion {
    return this.correction.clone();
  }

  isIdentity(): boolean {
    return Quaternion.Dot(this.correction, Quaternion.Identity()) > 0.9999;
  }
}

/** @deprecated Use ModelAxisCorrection — visual-only export fix. */
export class ShipAxisFrame extends ModelAxisCorrection {}

function basisMatrix(right: Vector3, up: Vector3, forward: Vector3): Matrix {
  return Matrix.FromValues(
    right.x,
    right.y,
    right.z,
    0,
    up.x,
    up.y,
    up.z,
    0,
    forward.x,
    forward.y,
    forward.z,
    0,
    0,
    0,
    0,
    1
  );
}

export function applyModelAxisCorrection(
  visualRoot: TransformNode,
  config?: Partial<ShipAxisConventionConfig>
): void {
  const resolved = resolveShipAxisConfig(config);
  applyMirrorScale(visualRoot, resolved.mirror);

  const correction = new ModelAxisCorrection(resolved);
  if (correction.isIdentity()) return;

  const base = visualRoot.rotationQuaternion ?? Quaternion.Identity();
  visualRoot.rotationQuaternion = correction.getVisualCorrectionQuaternion().multiply(base).normalize();
}
