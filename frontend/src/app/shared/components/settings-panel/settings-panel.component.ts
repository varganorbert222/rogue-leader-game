import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  gamepadIdsMatch,
  listConnectedGamepads,
  normalizeSelectedGamepadId,
  wakeGamepads,
  type ConnectedGamepadInfo,
  type FlightPreferences,
} from '@rogue-leader/game';
import { AudioSettingsService } from '../../../core/services/audio-settings.service';
import { FlightSettingsService } from '../../../core/services/flight-settings.service';

export interface AudioSettingsSnapshot {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss',
})
export class SettingsPanelComponent implements OnInit, OnDestroy {
  @Input() showGraphics = true;
  @Input() showControlsHint = true;

  @Output() audioChange = new EventEmitter<AudioSettingsSnapshot>();
  @Output() flightChange = new EventEmitter<FlightPreferences>();

  master = 85;
  music = 60;
  sfx = 80;
  muted = false;
  shadows = true;
  autoRoll = true;
  selectedGamepadId: string | null = null;
  gamepads: ConnectedGamepadInfo[] = [];

  private padPoll?: number;
  private readonly onPadChange = (): void => this.refreshGamepads();

  constructor(
    private readonly settings: AudioSettingsService,
    private readonly flightSettings: FlightSettingsService
  ) {}

  ngOnInit(): void {
    const audio = this.settings.get();
    this.master = Math.round(audio.master * 100);
    this.music = Math.round(audio.music * 100);
    this.sfx = Math.round(audio.sfx * 100);
    this.muted = audio.muted;

    const flight = this.flightSettings.reload();
    this.autoRoll = flight.autoRoll;
    this.selectedGamepadId = normalizeSelectedGamepadId(flight.selectedGamepadId);

    this.refreshGamepads();
    window.addEventListener('gamepadconnected', this.onPadChange);
    window.addEventListener('gamepaddisconnected', this.onPadChange);
    this.padPoll = window.setInterval(() => this.refreshGamepads(), 1000);
  }

  ngOnDestroy(): void {
    window.removeEventListener('gamepadconnected', this.onPadChange);
    window.removeEventListener('gamepaddisconnected', this.onPadChange);
    if (this.padPoll !== undefined) {
      window.clearInterval(this.padPoll);
    }
  }

  refreshGamepads(): void {
    wakeGamepads();
    this.gamepads = listConnectedGamepads();
  }

  get savedGamepadMissing(): boolean {
    return (
      this.selectedGamepadId !== null &&
      !this.gamepads.some((pad) => gamepadIdsMatch(this.selectedGamepadId!, pad.id))
    );
  }

  applyAudio(): void {
    const snapshot: AudioSettingsSnapshot = {
      master: this.master / 100,
      music: this.music / 100,
      sfx: this.sfx / 100,
      muted: this.muted,
    };
    this.settings.update(snapshot);
    this.audioChange.emit(snapshot);
  }

  applyFlight(): void {
    const prefs = this.flightSettings.update({
      autoRoll: this.autoRoll,
      selectedGamepadId: normalizeSelectedGamepadId(this.selectedGamepadId),
    });
    this.flightChange.emit(prefs);
  }
}
