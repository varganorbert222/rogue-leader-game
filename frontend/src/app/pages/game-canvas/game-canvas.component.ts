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
import { MissionManager, type MissionEndState, type MissionHudState } from '@rogue-leader/game';
import { AudioBootstrapService } from '../../services/audio-bootstrap.service';
import { AudioSettingsService } from '../../services/audio-settings.service';
import { FlightSettingsService } from '../../services/flight-settings.service';

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  imports: [RouterLink],
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
    totalWaves: 2,
    enemiesRemaining: 0,
    backend: '…',
    laserReady: true,
    reticleInner: { xPct: 50, yPct: 50, visible: false },
    reticleOuter: { xPct: 50, yPct: 50, visible: false },
  };

  paused = false;
  endState: MissionEndState | null = null;
  missionName = '';

  async ngOnInit(): Promise<void> {
    const missionId = this.route.snapshot.paramMap.get('missionId') ?? 'battle_over_hoth_space';
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
    this.mission.applyFlightAssist(flight);

    try {
      await this.mission.load(missionId);
    } catch (err) {
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
      this.togglePause();
    }
    if (event.code === 'KeyM') {
      const s = this.audioSettings.get();
      const muted = !s.muted;
      this.audioSettings.update({ muted });
      this.mission?.applyAudioSettings(s.master, s.music, s.sfx, muted);
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.mission?.setPaused(this.paused);
  }

  quitToMenu(): void {
    this.mission?.dispose();
    this.host?.dispose();
    void this.router.navigate(['/']);
  }
}
