import { Quaternion, Scalar, Vector3 } from '@babylonjs/core';
import { getShipUp } from './ship-forward';

/** Second-order spring for camera position and orientation. */
export class CameraSpringRig {
  private readonly positionVelocity = Vector3.Zero();
  private readonly angularVelocity = Vector3.Zero();
  private readonly orientation = Quaternion.Identity();
  private orientationInitialized = false;

  reset(position: Vector3, orientation: Quaternion): void {
    this.positionVelocity.setAll(0);
    this.angularVelocity.setAll(0);
    this.orientation.copyFrom(orientation);
    this.orientationInitialized = true;
  }

  getOrientation(): Quaternion {
    return this.orientation.clone();
  }

  stepPosition(
    current: Vector3,
    desired: Vector3,
    dt: number,
    stiffness: number,
    damping: number
  ): Vector3 {
    const displacement = desired.subtract(current);
    const accel = displacement
      .scale(stiffness)
      .subtract(this.positionVelocity.scale(damping));
    this.positionVelocity.addInPlace(accel.scale(dt));
    return current.add(this.positionVelocity.scale(dt));
  }

  stepOrientation(
    target: Quaternion,
    dt: number,
    stiffness: number,
    damping: number
  ): Quaternion {
    if (!this.orientationInitialized) {
      this.orientation.copyFrom(target);
      this.orientationInitialized = true;
      return this.orientation.clone();
    }

    const inv = this.orientation.conjugate().normalize();
    let delta = target.multiply(inv).normalize();
    if (delta.w < 0) {
      delta = new Quaternion(-delta.x, -delta.y, -delta.z, -delta.w);
    }

    const angle = 2 * Math.acos(Scalar.Clamp(delta.w, -1, 1));
    let axis: Vector3;
    if (angle < 1e-6) {
      axis = Vector3.Zero();
    } else {
      const sinHalf = Math.sin(angle / 2);
      axis = new Vector3(delta.x / sinHalf, delta.y / sinHalf, delta.z / sinHalf);
    }

    const rotDisplacement = axis.scale(angle);
    const accel = rotDisplacement
      .scale(stiffness)
      .subtract(this.angularVelocity.scale(damping));
    this.angularVelocity.addInPlace(accel.scale(dt));

    const step = this.angularVelocity.length() * dt;
    if (step > 1e-6) {
      const stepAxis = this.angularVelocity.clone().normalize();
      const stepQ = Quaternion.RotationAxis(stepAxis, step);
      this.orientation.copyFrom(stepQ.multiply(this.orientation).normalize());
    }

    return this.orientation.clone();
  }

  upVector(): Vector3 {
    return getShipUp(this.orientation);
  }
}
