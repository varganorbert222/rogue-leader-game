import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AudioBootstrapService } from '../../services/audio-bootstrap.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss',
})
export class MainMenuComponent implements OnInit {
  constructor(
    private readonly router: Router,
    protected readonly audio: AudioBootstrapService
  ) {}

  ngOnInit(): void {
    void this.audio.ensureReady().then(() => this.audio.unlockAndPlayMenu());
  }

  async start(): Promise<void> {
    this.audio.playUiConfirm();
    await this.audio.unlockAndPlayMenu();
    void this.router.navigate(['/mission-select']);
  }

  settings(): void {
    this.audio.playUiClick();
    void this.router.navigate(['/settings']);
  }

  controls(): void {
    this.audio.playUiClick();
    void this.router.navigate(['/controls']);
  }
}
