import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ControlBindingsConfig } from '@rogue-leader/game';
import { ControlsPanelComponent } from '../../components/controls-panel/controls-panel.component';
import { AudioBootstrapService } from '../../services/audio-bootstrap.service';
import { FlightSettingsService } from '../../services/flight-settings.service';

@Component({
  selector: 'app-controls',
  standalone: true,
  imports: [RouterLink, ControlsPanelComponent],
  templateUrl: './controls.component.html',
  styleUrl: './controls.component.scss',
})
export class ControlsComponent implements OnInit {
  constructor(
    protected readonly audio: AudioBootstrapService,
    private readonly flightSettings: FlightSettingsService
  ) {}

  ngOnInit(): void {
    void this.audio.ensureReady();
  }

  onControlsChange(config: ControlBindingsConfig): void {
    this.flightSettings.update({
      selectedGamepadId: config.gamepad.selectedGamepadId,
    });
    this.audio.playUiClick();
  }
}
