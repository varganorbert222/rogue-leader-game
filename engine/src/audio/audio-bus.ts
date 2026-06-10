/** Volume buses for master / music / sfx mixing. */
export class AudioBus {
  master = 1;
  music = 0.6;
  sfx = 0.8;
  muted = false;

  effectiveMusic(): number {
    return this.muted ? 0 : this.master * this.music;
  }

  effectiveSfx(): number {
    return this.muted ? 0 : this.master * this.sfx;
  }
}
