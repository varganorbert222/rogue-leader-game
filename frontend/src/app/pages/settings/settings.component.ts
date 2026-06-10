import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AudioBootstrapService } from '../../services/audio-bootstrap.service';
import { AudioSettingsService } from '../../services/audio-settings.service';
import { FlightSettingsService } from '../../services/flight-settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  master = 85;
  music = 60;
  sfx = 80;
  muted = false;
  shadows = true;
  autoRoll = true;

  constructor(
    private readonly settings: AudioSettingsService,
    private readonly flightSettings: FlightSettingsService,
    protected readonly audio: AudioBootstrapService
  ) {}

  ngOnInit(): void {
    const s = this.settings.get();
    this.master = Math.round(s.master * 100);
    this.music = Math.round(s.music * 100);
    this.sfx = Math.round(s.sfx * 100);
    this.muted = s.muted;

    this.autoRoll = this.flightSettings.get().autoRoll;

    void this.audio.ensureReady();
  }

  apply(): void {
    this.settings.update({
      master: this.master / 100,
      music: this.music / 100,
      sfx: this.sfx / 100,
      muted: this.muted,
    });
    void this.audio.ensureReady().then((host) => {
      host.audio.setMasterVolume(this.master / 100);
      host.audio.setMusicVolume(this.music / 100);
      host.audio.setSfxVolume(this.sfx / 100);
      host.audio.setMuted(this.muted);
    });
    this.audio.playUiClick();
  }

  applyFlight(): void {
    this.flightSettings.update({ autoRoll: this.autoRoll });
    this.audio.playUiClick();
  }
}
