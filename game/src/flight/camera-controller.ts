import {
  FreeCamera,
  Quaternion,
  Vector3,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { CameraInput } from '../player/input/camera-input';
import type { FlightInput } from '../player/input/i-input-source';
import {
  FollowCameraDriver,
  OUTSIDE_VIEW_MODES,
  ScriptedCameraDriver,
  type CameraViewMode,
  type FollowCameraState,
} from './camera-drivers';
import {
  CAMERA_SPRING_PROFILES,
  cycleCameraSpringProfile,
  DEFAULT_CAMERA_SPRING_PROFILE,
  type CameraSpringProfileId,
} from './camera-profile';
import { CameraSpringRig } from './camera-spring';
import { getShipForward, getShipUp } from './ship-forward';

export type { CameraViewMode };

export type CameraDriverKind = 'follow' | 'scripted';

export class CameraController {
  private readonly camera: FreeCamera;
  private readonly spring = new CameraSpringRig();
  private readonly followDriver = new FollowCameraDriver();
  private readonly scriptedDriver = new ScriptedCameraDriver();

  private activeDriver: CameraDriverKind = 'follow';
  private viewMode: CameraViewMode = 'standard';
  private springProfileId: CameraSpringProfileId = DEFAULT_CAMERA_SPRING_PROFILE;
  private shakeTime = 0;

  private readonly followState: FollowCameraState = {
    behavior: 'follow',
    orbitYaw: 0,
    distanceBias: 0,
    dropOffset: 0,
    lookAroundYaw: 0,
    lookAroundPitch: 0,
    orbitIdleSec: 0,
  };

  private prevShipPos: Vector3 | null = null;
  private prevShipRot = Quaternion.Identity();

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

  getMode(): CameraViewMode {
    return this.viewMode;
  }

  getSpringProfileId(): CameraSpringProfileId {
    return this.springProfileId;
  }

  setSpringProfile(id: CameraSpringProfileId): void {
    this.springProfileId = id;
  }

  cycleSpringProfile(): CameraSpringProfileId {
    this.springProfileId = cycleCameraSpringProfile(this.springProfileId);
    return this.springProfileId;
  }

  getActiveDriver(): CameraDriverKind {
    return this.activeDriver;
  }

  /** Switch to scripted / cinematic driver (mission intros, future rails). */
  useScriptedDriver(): ScriptedCameraDriver {
    this.activeDriver = 'scripted';
    this.viewMode = 'cinematic';
    return this.scriptedDriver;
  }

  useFollowDriver(): void {
    this.activeDriver = 'follow';
    if (this.viewMode === 'cinematic') {
      this.viewMode = 'standard';
    }
  }

  startIntro(durationSec: number): void {
    this.useScriptedDriver();
    this.scriptedDriver.startIntro(durationSec);
  }

  toggleCockpit(): CameraViewMode {
    this.useFollowDriver();
    this.viewMode = this.viewMode === 'cockpit' ? 'standard' : 'cockpit';
    if (this.viewMode !== 'cockpit') {
      this.followState.lookAroundYaw = 0;
      this.followState.lookAroundPitch = 0;
      this.resetOutsideCamera();
    }
    return this.viewMode;
  }

  cycleOutsideView(): CameraViewMode {
    this.useFollowDriver();
    if (this.viewMode === 'cockpit' || this.viewMode === 'cinematic') {
      this.viewMode = 'standard';
      this.resetOutsideCamera();
      return this.viewMode;
    }
    const idx = OUTSIDE_VIEW_MODES.indexOf(
      this.viewMode as (typeof OUTSIDE_VIEW_MODES)[number]
    );
    this.viewMode = OUTSIDE_VIEW_MODES[(idx + 1) % OUTSIDE_VIEW_MODES.length];
    this.resetOutsideCamera();
    return this.viewMode;
  }

  triggerDropCamera(): void {
    this.followState.dropOffset = 1;
  }

  shake(duration = 0.25): void {
    this.shakeTime = duration;
  }

  update(dt: number, target: TransformNode, input?: CameraInput | FlightInput): void {
    if (input?.cameraToggle) this.toggleCockpit();
    if (input?.cameraCycle) {
      for (let i = 0; i < input.cameraCycle; i++) this.cycleOutsideView();
    }
    if (input?.cameraDrop) this.triggerDropCamera();
    if (input?.cameraProfileCycle) this.cycleSpringProfile();

    const shipPos = target.getAbsolutePosition();
    const shipRot = target.rotationQuaternion ?? Quaternion.Identity();
    const lagReferenceRot = this.prevShipRot.clone();
    const shipVel =
      this.prevShipPos && dt > 0
        ? shipPos.subtract(this.prevShipPos).scale(1 / dt)
        : Vector3.Zero();

    const shakeOffset = this.sampleShake(dt);
    const profile = CAMERA_SPRING_PROFILES[this.springProfileId];

    let desiredPos: Vector3;
    let desiredRot: Quaternion;
    let directAttach = false;

    if (this.activeDriver === 'scripted') {
      this.scriptedDriver.update(dt);
      const pose = this.scriptedDriver.computeDesired({ dt, target, timeSec: 0 });
      desiredPos = pose.position;
      desiredRot = pose.orientation;
      directAttach = pose.directAttach ?? false;

      if (this.scriptedDriver.isFinished()) {
        this.useFollowDriver();
        this.viewMode = 'standard';
        this.resetOutsideCamera();
      }
    } else {
      const pose = this.followDriver.computeDesired({
        dt,
        target,
        viewMode: this.viewMode,
        input,
        inputResponse: profile.inputResponse,
        shipVelocity: shipVel,
        rotationLag: profile.rotationLag,
        velocityLag: profile.velocityLag,
        prevShipRot: lagReferenceRot,
        shakeOffset,
        state: this.followState,
      });
      desiredPos = pose.position;
      desiredRot = pose.orientation;
      directAttach = pose.directAttach ?? false;
      if (pose.snapSpring) {
        directAttach = true;
      }
    }

    if (directAttach) {
      this.camera.position.copyFrom(desiredPos);
      this.spring.reset(desiredPos, desiredRot);
      this.camera.rotationQuaternion = desiredRot.clone();
      this.camera.upVector.copyFrom(getShipUp(desiredRot));
      this.prevShipPos = shipPos.clone();
      this.prevShipRot = shipRot.clone();
      return;
    }

    this.prevShipPos = shipPos.clone();
    this.prevShipRot = shipRot.clone();

    const nextPos = this.spring.stepPosition(
      this.camera.position,
      desiredPos,
      dt,
      profile.positionStiffness,
      profile.positionDamping
    );
    this.camera.position.copyFrom(nextPos);

    const nextRot = this.spring.stepOrientation(
      desiredRot,
      dt,
      profile.orientationStiffness,
      profile.orientationDamping
    );
    this.camera.rotationQuaternion = nextRot;
    this.camera.upVector.copyFrom(this.spring.upVector());
  }

  private sampleShake(dt: number): Vector3 {
    if (this.shakeTime <= 0) {
      return Vector3.Zero();
    }
    this.shakeTime -= dt;
    return new Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      0
    );
  }

  private resetOutsideCamera(): void {
    this.followState.behavior = 'follow';
    this.followState.orbitYaw = 0;
    this.followState.orbitIdleSec = 0;
  }
}
