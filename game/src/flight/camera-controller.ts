import {
  FreeCamera,
  Quaternion,
  Scalar,
  Vector3,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { FlightInput } from '../input/i-input-source';
import { getShipForward, getShipRight, getShipUp } from './ship-forward';

/** Rogue Leader / Rogue Squadron outside camera presets */
export type CameraMode = 'standard' | 'close' | 'far' | 'cockpit' | 'cinematic';

const MODE_PRESETS: Record<Exclude<CameraMode, 'cinematic'>, { distance: number; height: number }> = {
  standard: { distance: 18, height: 4 },
  close: { distance: 12, height: 3 },
  far: { distance: 32, height: 8 },
  cockpit: { distance: 0, height: 0 },
};

const OUTSIDE_MODES: Exclude<CameraMode, 'cinematic' | 'cockpit'>[] = [
  'standard',
  'close',
  'far',
];

export class CameraController {
  private readonly camera: FreeCamera;
  private mode: CameraMode = 'standard';
  private cinematicTime = 0;
  private cinematicDuration = 0;
  private shakeTime = 0;

  private readonly positionVelocity = Vector3.Zero();
  private readonly angularVelocity = Vector3.Zero();
  private readonly cameraOrientation = Quaternion.Identity();
  private orientationInitialized = false;

  private orbitAngle = 0;
  private distanceBias = 0;
  private dropOffset = 0;
  private lookAroundYaw = 0;
  private lookAroundPitch = 0;

  private readonly springStiffness = 140;
  private readonly springDamping = 18;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new FreeCamera('chaseCam', Vector3.Zero(), scene);
    this.camera.minZ = 0.5;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
    void canvas;
  }

  getCamera(): FreeCamera {
    return this.camera;
  }

  startCinematic(durationSec: number): void {
    this.mode = 'cinematic';
    this.cinematicTime = 0;
    this.cinematicDuration = durationSec;
  }

  /** X — toggle cockpit / chase (Rogue Leader) */
  toggleCockpit(): CameraMode {
    this.mode = this.mode === 'cockpit' ? 'standard' : 'cockpit';
    if (this.mode !== 'cockpit') {
      this.lookAroundYaw = 0;
      this.lookAroundPitch = 0;
    }
    return this.mode;
  }

  /** ~ / F-keys — cycle standard → close → far */
  cycleOutsideView(): CameraMode {
    if (this.mode === 'cockpit' || this.mode === 'cinematic') {
      this.mode = 'standard';
      return this.mode;
    }
    const idx = OUTSIDE_MODES.indexOf(this.mode as (typeof OUTSIDE_MODES)[number]);
    const next = OUTSIDE_MODES[(idx + 1) % OUTSIDE_MODES.length];
    this.mode = next;
    return this.mode;
  }

  /** Z — drop camera below craft */
  triggerDropCamera(): void {
    this.dropOffset = 1;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  shake(duration = 0.25): void {
    this.shakeTime = duration;
  }

  update(dt: number, target: TransformNode, input?: FlightInput): void {
    if (input?.cameraToggle) this.toggleCockpit();
    if (input?.cameraCycle) {
      for (let i = 0; i < input.cameraCycle; i++) this.cycleOutsideView();
    }
    if (input?.cameraDrop) this.triggerDropCamera();

    const orbitInput = input?.cameraOrbit ?? 0;
    const distInput = input?.cameraDistance ?? 0;
    this.orbitAngle = Scalar.Lerp(this.orbitAngle, orbitInput * 0.9, 1 - Math.pow(0.001, dt));
    this.distanceBias = Scalar.Lerp(this.distanceBias, distInput * 8, 1 - Math.pow(0.001, dt));
    this.dropOffset = Math.max(0, this.dropOffset - dt * 1.2);

    if (input?.lookAround && this.mode === 'cockpit') {
      this.lookAroundYaw = Scalar.Clamp(this.lookAroundYaw + orbitInput * dt * 2.5, -0.8, 0.8);
      this.lookAroundPitch = Scalar.Clamp(this.lookAroundPitch + distInput * dt * 2.5, -0.5, 0.5);
    } else if (this.mode !== 'cockpit') {
      this.lookAroundYaw = Scalar.Lerp(this.lookAroundYaw, 0, 1 - Math.pow(0.02, dt));
      this.lookAroundPitch = Scalar.Lerp(this.lookAroundPitch, 0, 1 - Math.pow(0.02, dt));
    }

    const pos = target.getAbsolutePosition();
    const rot = target.rotationQuaternion ?? Quaternion.Identity();
    const fwd = getShipForward(rot);
    const right = getShipRight(rot);
    const up = getShipUp(rot);

    let distance = MODE_PRESETS.standard.distance;
    let height = MODE_PRESETS.standard.height;

    if (this.mode === 'cinematic') {
      this.cinematicTime += dt;
      const t = Math.min(1, this.cinematicTime / this.cinematicDuration);
      distance = 40 - t * 20;
      height = 12 - t * 6;
      if (t >= 1) this.mode = 'standard';
    } else if (this.mode === 'cockpit') {
      const cockpitPos = pos.add(fwd.scale(0.35)).add(up.scale(0.15));
      this.springMoveTo(cockpitPos, dt);

      const lookYaw = Quaternion.RotationAxis(up, this.lookAroundYaw);
      const lookPitch = Quaternion.RotationAxis(right, this.lookAroundPitch);
      const lookOffset = lookPitch.multiply(lookYaw);
      this.springOrientation(this.targetCameraRotation(rot, lookOffset), dt);
      return;
    } else {
      const preset = MODE_PRESETS[this.mode as keyof typeof MODE_PRESETS] ?? MODE_PRESETS.standard;
      distance = preset.distance + this.distanceBias;
      height = preset.height;
    }

    const back = fwd.scale(-1);
    const orbitRight = right.scale(Math.sin(this.orbitAngle) * distance * 0.35);
    const dropDown = up.scale(-this.dropOffset * 10);

    let desired = pos
      .add(back.scale(distance))
      .add(up.scale(height))
      .add(orbitRight)
      .add(dropDown);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      desired.x += (Math.random() - 0.5) * 0.8;
      desired.y += (Math.random() - 0.5) * 0.8;
    }

    this.springMoveTo(desired, dt);
    this.springOrientation(this.targetCameraRotation(rot), dt);
  }

  /** Camera orientation matches ship (+Z forward in this project). */
  private targetCameraRotation(shipRot: Quaternion, lookOffset?: Quaternion): Quaternion {
    return lookOffset ? lookOffset.multiply(shipRot).normalize() : shipRot.clone();
  }

  private springMoveTo(desired: Vector3, dt: number): void {
    const displacement = desired.clone().subtract(this.camera.position);
    const accel = displacement
      .scale(this.springStiffness)
      .subtract(this.positionVelocity.scale(this.springDamping));
    this.positionVelocity.addInPlace(accel.scale(dt));
    this.camera.position.addInPlace(this.positionVelocity.scale(dt));
  }

  private springOrientation(target: Quaternion, dt: number): void {
    if (!this.orientationInitialized) {
      this.cameraOrientation.copyFrom(target);
      this.orientationInitialized = true;
      this.applyCameraOrientation();
      return;
    }

    const inv = this.cameraOrientation.conjugate().normalize();
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
      .scale(this.springStiffness)
      .subtract(this.angularVelocity.scale(this.springDamping));
    this.angularVelocity.addInPlace(accel.scale(dt));

    const step = this.angularVelocity.length() * dt;
    if (step > 1e-6) {
      const stepAxis = this.angularVelocity.clone().normalize();
      const stepQ = Quaternion.RotationAxis(stepAxis, step);
      this.cameraOrientation.copyFrom(stepQ.multiply(this.cameraOrientation).normalize());
    }

    this.applyCameraOrientation();
  }

  private applyCameraOrientation(): void {
    this.camera.rotationQuaternion = this.cameraOrientation.clone();
    this.camera.upVector.copyFrom(getShipUp(this.cameraOrientation));
  }
}
