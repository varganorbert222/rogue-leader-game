import {
  FreeCamera,
  Quaternion,
  Scalar,
  Vector3,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import {
  createCockpitInputOffsetState,
  resetCockpitInputOffsetState,
  updateCockpitInputOffsetState,
  BABYLON_MIN_CAMERA_NEAR_Z,
  CHASE_CAMERA_NEAR_Z,
  type CockpitInputOffsetState,
  type CockpitVehicleInput,
  type ResolvedCockpitConfig,
} from '@rogue-leader/engine';
import type { CameraInput } from '../player/input/camera-input';
import type { FlightInput } from '../player/input/i-input-source';
import { ZERO_VEHICLE_INPUT, type VehicleInput } from '../player/input/vehicle-input';
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
  private prevShipVel = Vector3.Zero();
  private prevAngularVel = Vector3.Zero();
  private cockpitConfig: ResolvedCockpitConfig | null = null;
  private readonly cockpitInputOffset = createCockpitInputOffsetState();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new FreeCamera('chaseCam', Vector3.Zero(), scene);
    this.camera.minZ = CHASE_CAMERA_NEAR_Z;
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

  setCockpitConfig(config: ResolvedCockpitConfig | null): void {
    this.cockpitConfig = config;
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
    if (!this.cockpitConfig) return this.viewMode;
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

  update(
    dt: number,
    target: TransformNode,
    input?: CameraInput | FlightInput,
    visualRot?: Quaternion,
    vehicleInput: VehicleInput = ZERO_VEHICLE_INPUT,
  ): void {
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
    const angularVel = this.estimateAngularVelocity(shipRot, lagReferenceRot, dt);
    const stickInput: CockpitVehicleInput = {
      throttle: vehicleInput.throttle,
      pitch: vehicleInput.pitch,
      yaw: vehicleInput.yaw,
      roll: vehicleInput.roll,
    };

    if (this.viewMode === 'cockpit' && this.cockpitConfig) {
      this.camera.minZ = BABYLON_MIN_CAMERA_NEAR_Z;
      updateCockpitInputOffsetState(
        this.cockpitInputOffset,
        dt,
        this.cockpitConfig.inputResponse,
        stickInput,
      );
      this.camera.fov = this.cockpitConfig.fov;
    } else {
      this.camera.minZ = CHASE_CAMERA_NEAR_Z;
      this.camera.fov = 1.05;
      resetCockpitInputOffsetState(this.cockpitInputOffset);
    }

    this.prevShipVel = shipVel.clone();
    this.prevAngularVel = angularVel.clone();

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
        cockpitConfig: this.cockpitConfig,
        inputOffsetState: this.cockpitInputOffset,
        visualRot,
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

  private estimateAngularVelocity(
    shipRot: Quaternion,
    prevRot: Quaternion,
    dt: number,
  ): Vector3 {
    if (dt <= 0) return Vector3.Zero();
    const invPrev = prevRot.conjugate();
    const delta = shipRot.multiply(invPrev);
    const angle = 2 * Math.acos(Scalar.Clamp(Math.abs(delta.w), 0, 1));
    if (angle < 1e-6) return Vector3.Zero();
    const axis = new Vector3(delta.x, delta.y, delta.z);
    if (axis.lengthSquared() < 1e-8) return Vector3.Zero();
    return axis.normalize().scale(angle / dt);
  }
}
