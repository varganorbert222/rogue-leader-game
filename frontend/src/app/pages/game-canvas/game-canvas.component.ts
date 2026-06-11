import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BabylonHost } from '@rogue-leader/engine';
import {
  MissionManager,
  wakeGamepads,
  type FlightPreferences,
  type MissionEndState,
  type MissionHudState,
} from '@rogue-leader/game';
import { AudioBootstrapService } from '../../services/audio-bootstrap.service';
import { AudioSettingsService } from '../../services/audio-settings.service';
import { FlightSettingsService } from '../../services/flight-settings.service';
import {
  SettingsPanelComponent,
  type AudioSettingsSnapshot,
} from '../../components/settings-panel/settings-panel.component';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  imports: [RouterLink, SettingsPanelComponent],
  templateUrl: './game-canvas.component.html',
  styleUrl: './game-canvas.component.scss',
})
export class GameCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private host: BabylonHost | null = null;
  private mission: MissionManager | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly audioBootstrap = inject(AudioBootstrapService);
  private readonly audioSettings = inject(AudioSettingsService);
  private readonly flightSettings = inject(FlightSettingsService);

  hud: MissionHudState = {
    health: 100,
    maxHealth: 100,
    shield: 50,
    maxShield: 50,
    wave: 1,
    totalWaves: 1,
    enemiesRemaining: 0,
    backend: '…',
    laserReady: true,
    reticleInner: { xPct: 50, yPct: 50, visible: false },
    reticleOuter: { xPct: 50, yPct: 50, visible: false },
    targetLock: null,
  };

  paused = false;
  showSettings = false;
  endState: MissionEndState | null = null;
  missionName = '';
  loading = true;
  loadingMessage = 'Loading mission…';

  async ngOnInit(): Promise<void> {
    const missionId = this.route.snapshot.paramMap.get('missionId') ?? 'asteroid_field_space';
    const config = MissionManager.getConfig(missionId);
    this.missionName = config?.displayName ?? missionId;

    this.audioBootstrap.handoffToGame()?.dispose();

    const canvas = this.canvasRef.nativeElement;
    this.host = await BabylonHost.create(canvas);
    await this.host.audio.unlock();

    const settings = this.audioSettings.get();
    const flight = this.flightSettings.get();
    this.mission = new MissionManager(this.host, canvas);
    this.mission.applyAudioSettings(settings.master, settings.music, settings.sfx, settings.muted);
    this.mission.applyFlightPreferences(flight);
    this.mission.setLoadProgressCallback((progress) => {
      this.loadingMessage = progress.message;
    });

    try {
      await this.mission.load(missionId);
      this.loading = false;
      canvas.setAttribute('tabindex', '0');
      canvas.focus();
      canvas.addEventListener('pointerdown', () => wakeGamepads());
    } catch (err) {
      this.loading = false;
      console.error(err);
      alert(String(err));
      void this.router.navigate(['/mission-select']);
      return;
    }

    this.host.startRenderLoop((dt) => {
      if (!this.paused && this.endState === null) {
        this.mission?.update(dt);
        const state = this.mission?.getEndState();
        if (state && state !== 'playing') {
          this.endState = state;
        }
      }
      if (this.mission) {
        this.hud = this.mission.getHudState();
      }
    });
  }

  ngOnDestroy(): void {
    this.mission?.dispose();
    this.host?.dispose();
    this.mission = null;
    this.host = null;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      if (this.showSettings) {
        this.closeSettings();
        return;
      }
      this.togglePause();
    }
    if (this.showSettings || this.paused || this.endState) {
      return;
    }
    if (event.code === 'KeyM') {
      const s = this.audioSettings.get();
      const muted = !s.muted;
      this.audioSettings.update({ muted });
      this.mission?.applyAudioSettings(s.master, s.music, s.sfx, muted);
    }
  }

  openSettings(): void {
    this.showSettings = true;
    if (!this.paused) {
      this.paused = true;
      this.mission?.setPaused(true);
    }
  }

  closeSettings(): void {
    this.showSettings = false;
  }

  onSettingsAudioChange(snapshot: AudioSettingsSnapshot): void {
    this.mission?.applyAudioSettings(
      snapshot.master,
      snapshot.music,
      snapshot.sfx,
      snapshot.muted
    );
  }

  onSettingsFlightChange(prefs: FlightPreferences): void {
    this.mission?.applyFlightPreferences(prefs);
  }

  togglePause(): void {
    if (this.endState) return;
    this.showSettings = false;
    this.paused = !this.paused;
    this.mission?.setPaused(this.paused);
  }

  quitToMenu(): void {
    this.mission?.dispose();
    this.host?.dispose();
    void this.router.navigate(['/']);
  }
}
