import { Injectable } from '@angular/core';
import { BabylonHost } from '@rogue-leader/engine';
import { MusicTrackIds, UiSfxClipIds } from '@rogue-leader/game';
import { AudioSettingsService } from './audio-settings.service';

/** Hidden 1×1 canvas so menu routes can play music via Babylon Sound. */
@Injectable({ providedIn: 'root' })
export class AudioBootstrapService {
  private host: BabylonHost | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private unlocked = false;

  async ensureReady(): Promise<BabylonHost> {
    if (this.host) return this.host;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.canvas.style.position = 'fixed';
    this.canvas.style.left = '-9999px';
    document.body.appendChild(this.canvas);

    this.host = await BabylonHost.create(this.canvas);
    const settings = new AudioSettingsService().get();
    this.host.audio.setMasterVolume(settings.master);
    this.host.audio.setMusicVolume(settings.music);
    this.host.audio.setSfxVolume(settings.sfx);
    this.host.audio.setMuted(settings.muted);
    return this.host;
  }

  async unlockAndPlayMenu(): Promise<void> {
    const host = await this.ensureReady();
    if (!this.unlocked) {
      await host.audio.unlock();
      this.unlocked = true;
    }
    host.audio.playMusic(MusicTrackIds.MenuLoop, { fadeInMs: 500 });
  }

  playUiClick(): void {
    this.host?.audio.playSfx(UiSfxClipIds.Click);
  }

  playUiConfirm(): void {
    this.host?.audio.playSfx(UiSfxClipIds.Click);
  }

  playUiBack(): void {
    this.host?.audio.playSfx(UiSfxClipIds.Back);
  }

  playUiHover(): void {
    this.host?.audio.playSfx(UiSfxClipIds.Hover);
  }

  stopMusic(): void {
    this.host?.audio.stopMusic(400);
  }

  getHost(): BabylonHost | null {
    return this.host;
  }

  handoffToGame(): BabylonHost | null {
    const h = this.host;
    this.host = null;
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }
    return h;
  }
}
