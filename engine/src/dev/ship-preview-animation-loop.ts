import { AnimationGroup, Scene } from '@babylonjs/core';
import type { ShipManifestEntry } from '../loaders/asset-manifest';

interface ClipPlaybackState {
  /** 0 = folded, 1 = open */
  progress: number;
  direction: 1 | -1;
}

/** Continuous 0% → 100% → 0% preview playback for ship-select wireframe scenes. */
export class ShipPreviewAnimationLoop {
  private readonly clipStates = new Map<AnimationGroup, ClipPlaybackState>();
  private renderObserver: { remove: () => void } | null = null;
  private disposed = false;

  constructor(
    private readonly groups: readonly AnimationGroup[],
    private readonly scene: Scene,
    private readonly playbackSpeed = 1,
  ) {}

  static resolveGroups(
    entry: ShipManifestEntry,
    animationGroups: readonly AnimationGroup[],
  ): AnimationGroup[] {
    const config = entry.abilities?.sfoil?.animation ?? entry.animations;
    if (config?.transitions.length) {
      const clipNames = [...new Set(config.transitions.map((t) => t.clip))];
      const byName = new Map(animationGroups.map((group) => [group.name, group]));
      const resolved = clipNames
        .map((name) => byName.get(name))
        .filter((group): group is AnimationGroup => group != null);
      if (resolved.length > 0) return resolved;
    }
    return animationGroups.length > 0 ? [...animationGroups] : [];
  }

  start(): void {
    for (const group of this.groups) {
      this.clipStates.set(group, { progress: 0, direction: 1 });
      this.applyProgress(group, 0);
    }

    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.disposed) return;
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      for (const group of this.groups) {
        this.advance(group, dt);
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.renderObserver?.remove();
    this.renderObserver = null;
    for (const group of this.groups) {
      group.stop();
    }
    this.clipStates.clear();
  }

  private advance(group: AnimationGroup, dt: number): void {
    const state = this.clipStates.get(group);
    if (!state) return;

    const durationSec = this.clipDurationSec(group);
    if (durationSec <= 0) return;

    state.progress += (dt / durationSec) * state.direction;

    if (state.progress >= 1) {
      state.progress = 1;
      state.direction = -1;
    } else if (state.progress <= 0) {
      state.progress = 0;
      state.direction = 1;
    }

    this.applyProgress(group, state.progress);
  }

  private clipDurationSec(group: AnimationGroup): number {
    const frameSpan = Math.abs(group.to - group.from);
    const fps = this.resolveClipFps(group);
    return frameSpan / fps / this.playbackSpeed;
  }

  private resolveClipFps(group: AnimationGroup): number {
    for (const targeted of group.targetedAnimations) {
      const fps = targeted.animation.framePerSecond;
      if (fps > 0) return fps;
    }
    return 60;
  }

  private applyProgress(group: AnimationGroup, progress: number): void {
    const frame = group.from + (group.to - group.from) * progress;
    if (!group.isStarted) {
      group.stop();
      group.start(false, 1, group.from, group.to);
      if (!group.isStarted) return;
      group.goToFrame(frame);
      group.pause();
      return;
    }
    group.goToFrame(frame);
  }
}
