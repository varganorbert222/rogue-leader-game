import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MissionManager } from '@rogue-leader/game';
import { AudioBootstrapService } from '../../core/services/audio-bootstrap.service';
import {
  PageBackNavComponent,
  type PageBackNavItem,
} from '../../shared/components/page-back-nav/page-back-nav.component';

@Component({
  selector: 'app-mission-select',
  standalone: true,
  imports: [PageBackNavComponent],
  templateUrl: './mission-select.component.html',
  styleUrl: './mission-select.component.scss',
})
export class MissionSelectComponent implements OnInit {
  missions = MissionManager.getMissionList();

  readonly backLinks: PageBackNavItem[] = [
    { label: '← Main Menu', route: '/' },
  ];

  constructor(
    private readonly router: Router,
    protected readonly audio: AudioBootstrapService
  ) {}

  ngOnInit(): void {
    void this.audio.unlockAndPlayMenu();
  }

  play(id: string, stub: boolean, message?: string): void {
    if (stub) {
      alert(message ?? 'Coming soon');
      return;
    }
    this.audio.playUiConfirm();
    this.audio.stopMusic();
    void this.router.navigate(['/play', id]);
  }
}
