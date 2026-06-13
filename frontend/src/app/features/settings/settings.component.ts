import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SettingsPanelComponent,
  type AudioSettingsSnapshot,
} from '../../shared/components/settings-panel/settings-panel.component';
import { AudioBootstrapService } from '../../core/services/audio-bootstrap.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterLink, SettingsPanelComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  constructor(protected readonly audio: AudioBootstrapService) {}

  ngOnInit(): void {
    void this.audio.ensureReady();
  }

  onAudioChange(snapshot: AudioSettingsSnapshot): void {
    void this.audio.ensureReady().then((host) => {
      host.audio.setMasterVolume(snapshot.master);
      host.audio.setMusicVolume(snapshot.music);
      host.audio.setSfxVolume(snapshot.sfx);
      host.audio.setMuted(snapshot.muted);
    });
    this.audio.playUiClick();
  }

  onFlightChange(): void {
    this.audio.playUiClick();
  }
}
