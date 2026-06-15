import type { AnimationGroup } from '@babylonjs/core';

export interface DevPreviewAnimationInfo {
  index: number;
  name: string;
}

/** Manual GLTF animation playback for dev preview scenes (no auto-play). */
export class DevPreviewAnimationController {
  private groups: AnimationGroup[] = [];
  private playingIndex: number | null = null;

  setGroups(groups: readonly AnimationGroup[]): void {
    this.stopAll();
    this.groups = [...groups];
    this.stopAll();
  }

  listAnimations(): DevPreviewAnimationInfo[] {
    return this.groups.map((group, index) => ({
      index,
      name: group.name || `Animation ${index}`,
    }));
  }

  getPlayingIndex(): number | null {
    return this.playingIndex;
  }

  play(index: number, loop = false): void {
    this.stopAll();
    const group = this.groups[index];
    if (!group) return;
    group.start(loop);
    this.playingIndex = index;
  }

  stopAll(): void {
    for (const group of this.groups) {
      group.stop();
      group.reset();
    }
    this.playingIndex = null;
  }

  clear(): void {
    this.stopAll();
    this.groups = [];
  }
}
