import { AnimationGroup } from '@babylonjs/core';
import type { ShipAnimationManifest } from '../loaders/asset-manifest';

export class ShipAnimationController {
  private readonly groups = new Map<string, AnimationGroup>();
  private state: string;
  private playing = false;
  private activeGroup: AnimationGroup | null = null;
  private endObserver: { remove: () => void } | null = null;

  constructor(
    animationGroups: readonly AnimationGroup[],
    private readonly config: ShipAnimationManifest
  ) {
    for (const group of animationGroups) {
      this.groups.set(group.name, group);
    }
    this.state = config.initialState;
    this.applyInitialPose();
  }

  getState(): string {
    return this.state;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Toggle between two named states (e.g. folded ↔ open). */
  toggleBetween(stateA: string, stateB: string): boolean {
    if (this.playing) return false;
    const target = this.state === stateA ? stateB : stateA;
    return this.playTransitionTo(target);
  }

  playTransitionTo(
    targetState: string,
    onComplete?: (state: string) => void
  ): boolean {
    if (this.playing || targetState === this.state) return false;

    const transition = this.config.transitions.find((entry) => entry.toState === targetState);
    if (!transition) return false;

    const group = this.groups.get(transition.clip);
    if (!group) {
      console.warn(`[ShipAnimation] missing clip "${transition.clip}"`);
      return false;
    }

    this.clearEndObserver();
    group.stop();
    // 0% = group.from (folded), 100% = group.to (open). Speed sign sets direction.
    group.start(false, transition.speed, group.from, group.to);
    if (!group.isStarted) {
      return false;
    }

    this.playing = true;
    this.activeGroup = group;

    this.endObserver = group.onAnimationGroupEndObservable.add(() => {
      this.playing = false;
      this.activeGroup = null;
      this.state = targetState;
      this.clearEndObserver();
      const settleFrame = transition.speed < 0 ? group.from : group.to;
      this.snapClipToFrame(group, settleFrame);
      onComplete?.(targetState);
    });

    return true;
  }

  /** Snap all clips to the configured initial state without playing a transition. */
  snapToInitialState(): void {
    this.clearEndObserver();
    this.playing = false;
    this.activeGroup = null;
    this.state = this.config.initialState;
    this.applyInitialPose();
  }

  dispose(): void {
    this.clearEndObserver();
    for (const group of this.groups.values()) {
      if (group.isStarted) {
        group.pause();
      }
    }
  }

  private applyInitialPose(): void {
    for (const clipName of this.uniqueClipNames()) {
      const group = this.groups.get(clipName);
      if (!group) continue;
      this.snapClipToFrame(
        group,
        this.frameForState(this.config.initialState, clipName),
      );
    }
  }

  /** Babylon only applies {@link AnimationGroup.goToFrame} while the group is started. */
  private snapClipToFrame(group: AnimationGroup, frame: number): void {
    group.stop();
    group.start(false, 1, group.from, group.to);
    if (!group.isStarted) return;
    group.goToFrame(frame);
    group.pause();
  }

  private uniqueClipNames(): string[] {
    return [...new Set(this.config.transitions.map((entry) => entry.clip))];
  }

  private frameForState(state: string, clip: string): number {
    const group = this.groups.get(clip);
    if (!group) return 0;

    const forward = this.config.transitions.find(
      (entry) => entry.clip === clip && entry.speed > 0
    );
    const reverse = this.config.transitions.find(
      (entry) => entry.clip === clip && entry.speed < 0
    );

    if (forward && state === forward.toState) return group.to;
    if (reverse && state === reverse.toState) return group.from;
    if (forward && state !== forward.toState) return group.from;
    if (reverse && state !== reverse.toState) return group.to;
    return group.from;
  }

  private clearEndObserver(): void {
    this.endObserver?.remove();
    this.endObserver = null;
  }
}
