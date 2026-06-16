export interface Vec3Editable {
  x: number;
  y: number;
  z: number;
}

export interface Color4Editable {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function vec3(x = 0, y = 0, z = 0): Vec3Editable {
  return { x, y, z };
}

export function color4(r = 1, g = 1, b = 1, a = 1): Color4Editable {
  return { r, g, b, a };
}

export function cloneVec3(value: Vec3Editable): Vec3Editable {
  return { ...value };
}

export function mergeVec3(base: Vec3Editable, patch?: Partial<Vec3Editable>): Vec3Editable {
  if (!patch) return { ...base };
  return {
    x: patch.x ?? base.x,
    y: patch.y ?? base.y,
    z: patch.z ?? base.z,
  };
}

export function mergeColor4(
  base: Color4Editable,
  patch?: Partial<Color4Editable>,
): Color4Editable {
  return {
    r: patch?.r ?? base.r,
    g: patch?.g ?? base.g,
    b: patch?.b ?? base.b,
    a: patch?.a ?? base.a,
  };
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
