import { Component, OnInit } from '@angular/core';
import type { ControlBindingsConfig } from '@rogue-leader/game';
import { ControlsPanelComponent } from '../../shared/components/controls-panel/controls-panel.component';
import { AudioBootstrapService } from '../../core/services/audio-bootstrap.service';
import { FlightSettingsService } from '../../core/services/flight-settings.service';
import {
  PageBackNavComponent,
  type PageBackNavItem,
} from '../../shared/components/page-back-nav/page-back-nav.component';

@Component({
  selector: 'app-controls',
  standalone: true,
  imports: [ControlsPanelComponent, PageBackNavComponent],
  templateUrl: './controls.component.html',
  styleUrl: './controls.component.scss',
})
export class ControlsComponent implements OnInit {
  readonly backLinks: PageBackNavItem[] = [
    { label: '← Settings', route: '/settings' },
    { label: '← Main Menu', route: '/' },
  ];

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
