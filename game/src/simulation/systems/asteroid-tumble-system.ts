import { Quaternion } from '@babylonjs/core';
import { Role } from '../components/role-tag';
import type { World } from '../world';

export function runAsteroidTumbleSystem(world: World, dt: number): void {
  for (const id of world.queryByRole(Role.Asteroid)) {
    const body = world.get(id, 'asteroidBody');
    if (!body || body.tumbleSpeed <= 0) continue;

    const q = Quaternion.RotationAxis(body.tumbleAxis, body.tumbleSpeed * dt);
    body.root.rotationQuaternion = (
      body.root.rotationQuaternion ?? Quaternion.Identity()
    )
      .multiply(q)
      .normalize();
  }
}
