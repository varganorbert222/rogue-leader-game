import {
  CustomParticleEmitter,
  Vector3,
  type IParticleSystem,
} from '@babylonjs/core';
import type { Vec3Editable } from '../../shared/editable-primitives';
import type { ParticleShapeEditable } from '../types';

function toVector3(v: Vec3Editable): Vector3 {
  return new Vector3(v.x, v.y, v.z);
}

function createDonutEmitter(majorRadius: number, tubeRadius: number): CustomParticleEmitter {
  const emitter = new CustomParticleEmitter();
  const major = Math.max(majorRadius, 0.01);
  const tube = Math.max(tubeRadius, 0.01);

  emitter.particlePositionGenerator = (_index, _particle, out) => {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const ring = major + tube * Math.cos(v);
    out.x = ring * Math.cos(u);
    out.y = tube * Math.sin(v);
    out.z = ring * Math.sin(u);
  };

  return emitter;
}

export function applyParticleShape(ps: IParticleSystem, shape: ParticleShapeEditable): void {
  const d1 = toVector3(shape.direction1);
  const d2 = toVector3(shape.direction2);
  const radius = Math.max(shape.radius, 0);
  const length = Math.max(shape.length, 0);
  const tubeRadius = Math.max(shape.tubeRadius, 0);
  const volumeFill = 1;

  switch (shape.type) {
    case 'point':
      ps.createPointEmitter(d1, d2);
      break;
    case 'line': {
      const half = Math.max(length, 0.01) * 0.5;
      const thickness = 0.02;
      ps.createBoxEmitter(
        d1,
        d2,
        new Vector3(-thickness, -half, -thickness),
        new Vector3(thickness, half, thickness),
      );
      break;
    }
    case 'sphere':
      ps.createSphereEmitter(Math.max(radius, 0.01), volumeFill);
      break;
    case 'hemisphere':
      ps.createHemisphericEmitter(Math.max(radius, 0.01), volumeFill);
      break;
    case 'capsule':
      ps.createCylinderEmitter(Math.max(radius, 0.01), Math.max(length, 0.01), volumeFill, 0);
      break;
    case 'donut':
      ps.particleEmitterType = createDonutEmitter(Math.max(radius, 0.01), Math.max(tubeRadius, 0.01));
      break;
    case 'box':
    default:
      ps.createBoxEmitter(d1, d2, toVector3(shape.boxMin), toVector3(shape.boxMax));
      break;
  }
}
