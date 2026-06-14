import {
  Quaternion,
  Scalar,
  Vector3,
  type TransformNode,
} from "@babylonjs/core";
import {
  computeCockpitPose,
  createCockpitInputOffsetState,
  DEFAULT_COCKPIT_CONFIG,
  expSmoothingFactor,
  lerpAngleRad,
  quaternionLookAt,
  type CockpitInputOffsetState,
  type ResolvedCockpitConfig,
} from "@rogue-leader/engine";
import type { CameraInput } from "../player/input/camera-input";
import { getShipForward, getShipRight, getShipUp } from "./ship-forward";

/** Outside chase distance presets (Rogue Leader style). */
export type CameraViewMode =
  | "standard"
  | "close"
  | "far"
  | "cockpit"
  | "cinematic";

const VIEW_PRESETS: Record<
  Exclude<CameraViewMode, "cinematic">,
  { distance: number; height: number }
> = {
  standard: { distance: 12, height: 6 },
  close: { distance: 10, height: 4 },
  far: { distance: 40, height: 8 },
  cockpit: { distance: 0, height: 0 },
};

export const OUTSIDE_VIEW_MODES: Exclude<
  CameraViewMode,
  "cinematic" | "cockpit"
>[] = ["standard", "close", "far"];

export interface CameraDesiredPose {
  position: Vector3;
  orientation: Quaternion;
  /** When true, skip velocity / rotation lag (cockpit). */
  directAttach?: boolean;
  /** When true, snap spring rig to the chase pose (orbit → follow handoff). */
  snapSpring?: boolean;
}

/** Outside chase: horizontal orbit speed at full stick (rad/s). */
const ORBIT_YAW_SPEED = 2.75;
/** Seconds without orbit input before recentering to follow chase. */
const ORBIT_IDLE_DELAY_SEC = 2.5;
/** Recenter speed after idle (1/s, exponential). */
const ORBIT_RECENTER_SPEED = 2.8;
const ORBIT_INPUT_DEADZONE = 0.08;

/** Default chase camera vs user-driven orbit around the ship. */
export type OutsideCameraBehavior = "follow" | "orbit";

export interface FollowCameraState {
  /** Active outside-view behavior (follow = legacy chase cam). */
  behavior: OutsideCameraBehavior;
  /** Yaw orbit around ship up (radians, orbit mode only). */
  orbitYaw: number;
  distanceBias: number;
  dropOffset: number;
  lookAroundYaw: number;
  lookAroundPitch: number;
  /** Seconds since last orbit input while in orbit mode. */
  orbitIdleSec: number;
}

export interface FollowCameraContext {
  dt: number;
  target: TransformNode;
  viewMode: CameraViewMode;
  input?: CameraInput;
  inputResponse: number;
  shipVelocity: Vector3;
  rotationLag: number;
  velocityLag: number;
  prevShipRot: Quaternion;
  shakeOffset: Vector3;
  state: FollowCameraState;
  cockpitConfig?: ResolvedCockpitConfig | null;
  inputOffsetState?: CockpitInputOffsetState;
  /** Root rotation composed with visual axis fix + cosmetic bank roll. */
  visualRot?: Quaternion;
}

/** Computes desired chase / cockpit pose from ship transform. */
export class FollowCameraDriver {
  readonly kind = "follow" as const;

  computeDesired(ctx: FollowCameraContext): CameraDesiredPose {
    const pos = ctx.target.getAbsolutePosition();
    const rot = ctx.target.rotationQuaternion ?? Quaternion.Identity();
    const fwd = getShipForward(rot);
    const right = getShipRight(rot);
    const up = getShipUp(rot);
    const behaviorBeforeUpdate = ctx.state.behavior;

    this.updateUserOffsets(ctx);

    if (ctx.viewMode === "cockpit") {
      const config = ctx.cockpitConfig ?? DEFAULT_COCKPIT_CONFIG;
      const inputOffset = ctx.inputOffsetState ?? createCockpitInputOffsetState();
      const pose = computeCockpitPose(
        pos,
        rot,
        config,
        ctx.state.lookAroundYaw,
        ctx.state.lookAroundPitch,
        inputOffset,
        ctx.visualRot,
      );
      return {
        position: pose.position,
        orientation: pose.orientation,
        directAttach: true,
      };
    }

    const preset =
      VIEW_PRESETS[ctx.viewMode as keyof typeof VIEW_PRESETS] ??
      VIEW_PRESETS.standard;
    const distance = preset.distance + ctx.state.distanceBias;
    const height = preset.height;

    const back = fwd.scale(-1);
    const dropDown = up.scale(-ctx.state.dropOffset * 10);

    let desiredPos: Vector3;
    let desiredRot: Quaternion;

    if (ctx.state.behavior === "orbit") {
      const chaseOffset = back.scale(distance).add(up.scale(height));
      const orbitRot = Quaternion.RotationAxis(up, ctx.state.orbitYaw);
      const orbitalOffset = chaseOffset.applyRotationQuaternion(orbitRot);

      desiredPos = pos.add(orbitalOffset).add(dropDown).add(ctx.shakeOffset);

      if (ctx.velocityLag > 0 && ctx.shipVelocity.lengthSquared() > 1) {
        desiredPos = desiredPos.subtract(ctx.shipVelocity.scale(ctx.velocityLag));
      }

      const toShip = pos.subtract(desiredPos);
      desiredRot =
        toShip.lengthSquared() > 1e-6
          ? quaternionLookAt(desiredPos, pos, up)
          : Quaternion.Slerp(
              ctx.prevShipRot,
              rot,
              Scalar.Clamp(1 - ctx.rotationLag, 0.05, 1),
            );
    } else {
      desiredPos = pos
        .add(back.scale(distance))
        .add(up.scale(height))
        .add(dropDown)
        .add(ctx.shakeOffset);

      if (ctx.velocityLag > 0 && ctx.shipVelocity.lengthSquared() > 1) {
        desiredPos = desiredPos.subtract(ctx.shipVelocity.scale(ctx.velocityLag));
      }

      desiredRot = Quaternion.Slerp(
        ctx.prevShipRot,
        rot,
        Scalar.Clamp(1 - ctx.rotationLag, 0.05, 1),
      );
    }

    const snapSpring =
      behaviorBeforeUpdate === "orbit" && ctx.state.behavior === "follow";

    return {
      position: desiredPos,
      orientation: desiredRot,
      snapSpring,
    };
  }

  private updateUserOffsets(ctx: FollowCameraContext): void {
    const { input, dt, state, viewMode, inputResponse } = ctx;
    const orbitInput = input?.cameraOrbit ?? 0;
    const distInput = input?.cameraDistance ?? 0;
    const blend = expSmoothingFactor(inputResponse, dt);
    const hasOrbitInput =
      viewMode !== "cockpit" && Math.abs(orbitInput) > ORBIT_INPUT_DEADZONE;
    const cockpitLimits =
      ctx.cockpitConfig?.lookLimits ?? DEFAULT_COCKPIT_CONFIG.lookLimits;

    if (hasOrbitInput) {
      state.behavior = "orbit";
      state.orbitIdleSec = 0;
      state.orbitYaw += orbitInput * ORBIT_YAW_SPEED * dt;
    } else if (viewMode !== "cockpit" && state.behavior === "orbit") {
      state.orbitIdleSec += dt;
      if (state.orbitIdleSec >= ORBIT_IDLE_DELAY_SEC) {
        const recenter = expSmoothingFactor(ORBIT_RECENTER_SPEED, dt);
        state.orbitYaw = lerpAngleRad(state.orbitYaw, 0, recenter);
        if (Math.abs(state.orbitYaw) < 1e-4) {
          state.orbitYaw = 0;
          state.behavior = "follow";
          state.orbitIdleSec = 0;
        }
      }
    } else if (viewMode !== "cockpit") {
      state.orbitIdleSec = 0;
    } else {
      state.behavior = "follow";
      state.orbitIdleSec = 0;
      state.orbitYaw = 0;
    }

    state.distanceBias = Scalar.Lerp(state.distanceBias, distInput * 8, blend);
    state.dropOffset = Math.max(0, state.dropOffset - dt * 1.2);

    if (input?.lookAround && viewMode === "cockpit") {
      state.lookAroundYaw = Scalar.Clamp(
        state.lookAroundYaw + orbitInput * dt * 2.5,
        -cockpitLimits.yaw,
        cockpitLimits.yaw,
      );
      state.lookAroundPitch = Scalar.Clamp(
        state.lookAroundPitch + distInput * dt * 2.5,
        -cockpitLimits.pitch,
        cockpitLimits.pitch,
      );
    } else if (viewMode !== "cockpit") {
      const relax = expSmoothingFactor(4, dt);
      state.lookAroundYaw = Scalar.Lerp(state.lookAroundYaw, 0, relax);
      state.lookAroundPitch = Scalar.Lerp(state.lookAroundPitch, 0, relax);
    }
  }
}

/** Future: scripted / rail cinematic cameras. */
export interface CameraSequenceKeyframe {
  /** Normalized time 0–1 along the sequence. */
  t: number;
  /** Offset from target in ship-local space (forward +Z). */
  localOffset: [number, number, number];
  distance?: number;
  height?: number;
  fov?: number;
}

export interface CameraSequence {
  id: string;
  durationSec: number;
  keyframes: CameraSequenceKeyframe[];
}

export interface ScriptedCameraContext {
  dt: number;
  target: TransformNode;
  timeSec: number;
}

/**
 * Samples keyframed sequences; falls back to a simple intro pull-in until
 * full cinematic tooling is wired from mission scripts.
 */
export class ScriptedCameraDriver {
  readonly kind = "scripted" as const;

  private sequence: CameraSequence | null = null;
  private timeSec = 0;
  private useLegacyIntro = false;
  private legacyDuration = 0;

  playSequence(sequence: CameraSequence): void {
    this.sequence = sequence;
    this.timeSec = 0;
    this.useLegacyIntro = false;
  }

  startIntro(durationSec: number): void {
    this.sequence = null;
    this.useLegacyIntro = true;
    this.legacyDuration = durationSec;
    this.timeSec = 0;
  }

  isFinished(): boolean {
    if (this.useLegacyIntro) {
      return this.timeSec >= this.legacyDuration;
    }
    if (!this.sequence) return true;
    return this.timeSec >= this.sequence.durationSec;
  }

  update(dt: number): void {
    this.timeSec += dt;
  }

  computeDesired(ctx: ScriptedCameraContext): CameraDesiredPose {
    const pos = ctx.target.getAbsolutePosition();
    const rot = ctx.target.rotationQuaternion ?? Quaternion.Identity();
    const fwd = getShipForward(rot);
    const up = getShipUp(rot);

    if (this.sequence && this.sequence.keyframes.length > 0) {
      return this.sampleSequence(pos, rot, fwd, up);
    }

    const t = this.useLegacyIntro
      ? Math.min(1, this.timeSec / Math.max(this.legacyDuration, 1e-3))
      : 1;
    const distance = 40 - t * 20;
    const height = 12 - t * 6;
    const back = fwd.scale(-1);

    return {
      position: pos.add(back.scale(distance)).add(up.scale(height)),
      orientation: rot.clone(),
      directAttach: false,
    };
  }

  private sampleSequence(
    pos: Vector3,
    rot: Quaternion,
    fwd: Vector3,
    up: Vector3,
  ): CameraDesiredPose {
    const seq = this.sequence!;
    const u = Math.min(1, this.timeSec / Math.max(seq.durationSec, 1e-3));
    const frames = [...seq.keyframes].sort((a, b) => a.t - b.t);

    let a = frames[0];
    let b = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      if (u >= frames[i].t && u <= frames[i + 1].t) {
        a = frames[i];
        b = frames[i + 1];
        break;
      }
    }

    const span = Math.max(b.t - a.t, 1e-4);
    const localT = Scalar.Clamp((u - a.t) / span, 0, 1);
    const right = getShipRight(rot);

    const lerpOffset = (
      from: CameraSequenceKeyframe,
      to: CameraSequenceKeyframe,
    ) => {
      const ox = Scalar.Lerp(from.localOffset[0], to.localOffset[0], localT);
      const oy = Scalar.Lerp(from.localOffset[1], to.localOffset[1], localT);
      const oz = Scalar.Lerp(from.localOffset[2], to.localOffset[2], localT);
      return pos.add(fwd.scale(oz)).add(right.scale(ox)).add(up.scale(oy));
    };

    return {
      position: lerpOffset(a, b),
      orientation: rot.clone(),
    };
  }
}

/** Placeholder for spline / dolly rail cameras. */
export class RailCameraDriver {
  readonly kind = "rail" as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  computeDesired(_ctx: ScriptedCameraContext): CameraDesiredPose | null {
    return null;
  }
}

