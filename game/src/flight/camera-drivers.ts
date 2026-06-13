import {
  Quaternion,
  Scalar,
  Vector3,
  type TransformNode,
} from "@babylonjs/core";
import type { CameraInput } from "../input/camera-input";
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
}

export interface FollowCameraState {
  orbitAngle: number;
  distanceBias: number;
  dropOffset: number;
  lookAroundYaw: number;
  lookAroundPitch: number;
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

    this.updateUserOffsets(ctx);

    if (ctx.viewMode === "cockpit") {
      const cockpitPos = pos.add(fwd.scale(0.35)).add(up.scale(0.15));
      const lookYaw = Quaternion.RotationAxis(up, ctx.state.lookAroundYaw);
      const lookPitch = Quaternion.RotationAxis(
        right,
        ctx.state.lookAroundPitch,
      );
      const lookOffset = lookPitch.multiply(lookYaw);
      return {
        position: cockpitPos,
        orientation: lookOffset.multiply(rot).normalize(),
        directAttach: true,
      };
    }

    const preset =
      VIEW_PRESETS[ctx.viewMode as keyof typeof VIEW_PRESETS] ??
      VIEW_PRESETS.standard;
    const distance = preset.distance + ctx.state.distanceBias;
    const height = preset.height;

    const back = fwd.scale(-1);
    const orbitRight = right.scale(
      Math.sin(ctx.state.orbitAngle) * distance * 0.35,
    );
    const dropDown = up.scale(-ctx.state.dropOffset * 10);

    let desiredPos = pos
      .add(back.scale(distance))
      .add(up.scale(height))
      .add(orbitRight)
      .add(dropDown)
      .add(ctx.shakeOffset);

    if (ctx.velocityLag > 0 && ctx.shipVelocity.lengthSquared() > 1) {
      desiredPos = desiredPos.subtract(ctx.shipVelocity.scale(ctx.velocityLag));
    }

    const laggedRot = Quaternion.Slerp(
      ctx.prevShipRot,
      rot,
      Scalar.Clamp(1 - ctx.rotationLag, 0.05, 1),
    );

    return {
      position: desiredPos,
      orientation: laggedRot,
    };
  }

  private updateUserOffsets(ctx: FollowCameraContext): void {
    const { input, dt, state, viewMode, inputResponse } = ctx;
    const orbitInput = input?.cameraOrbit ?? 0;
    const distInput = input?.cameraDistance ?? 0;
    const blend = 1 - Math.exp(-inputResponse * dt);

    state.orbitAngle = Scalar.Lerp(state.orbitAngle, orbitInput * 0.9, blend);
    state.distanceBias = Scalar.Lerp(state.distanceBias, distInput * 8, blend);
    state.dropOffset = Math.max(0, state.dropOffset - dt * 1.2);

    if (input?.lookAround && viewMode === "cockpit") {
      state.lookAroundYaw = Scalar.Clamp(
        state.lookAroundYaw + orbitInput * dt * 2.5,
        -0.8,
        0.8,
      );
      state.lookAroundPitch = Scalar.Clamp(
        state.lookAroundPitch + distInput * dt * 2.5,
        -0.5,
        0.5,
      );
    } else if (viewMode !== "cockpit") {
      const relax = 1 - Math.exp(-4 * dt);
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
