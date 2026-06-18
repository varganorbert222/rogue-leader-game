import { Vector3 } from '@babylonjs/core';
import type { ParticleShapeEditable } from '../types';

export interface ShapeSpawnSample {
  position: Vector3;
  direction: Vector3;
}

function randomUnitVector(): Vector3 {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new Vector3(s * Math.cos(theta), u, s * Math.sin(theta));
}

function lerpVec(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, t: number): Vector3 {
  return new Vector3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}

export function sampleShapeSpawn(shape: ParticleShapeEditable): ShapeSpawnSample {
  const dir = lerpVec(shape.direction1, shape.direction2, Math.random()).normalize();

  switch (shape.type) {
    case 'sphere':
    case 'hemisphere': {
      const p = randomUnitVector().scale(shape.radius * Math.cbrt(Math.random()));
      if (shape.type === 'hemisphere' && p.y < 0) p.y *= -1;
      return { position: p, direction: dir };
    }
    case 'box': {
      const t = () => Math.random();
      const p = new Vector3(
        shape.boxMin.x + (shape.boxMax.x - shape.boxMin.x) * t(),
        shape.boxMin.y + (shape.boxMax.y - shape.boxMin.y) * t(),
        shape.boxMin.z + (shape.boxMax.z - shape.boxMin.z) * t(),
      );
      return { position: p, direction: dir };
    }
    case 'point':
    default:
      return { position: Vector3.Zero(), direction: dir };
  }
}
