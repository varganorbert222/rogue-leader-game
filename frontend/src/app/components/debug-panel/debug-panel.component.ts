import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DebugPreferences } from '@rogue-leader/game';
import { DebugSettingsService } from '../../services/debug-settings.service';

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss',
})
export class DebugPanelComponent implements OnInit {
  @Output() debugChange = new EventEmitter<DebugPreferences>();

  prefs!: DebugPreferences;

  constructor(private readonly debugSettings: DebugSettingsService) {}

  ngOnInit(): void {
    this.prefs = this.debugSettings.reload();
  }

  apply(): void {
    const next = this.debugSettings.update(this.prefs);
    this.prefs = next;
    this.debugChange.emit(next);
  }

  onMasterToggle(): void {
    this.apply();
  }

  onOverlayToggle(): void {
    this.apply();
  }

  onLabelToggle(): void {
    this.apply();
  }

  onGameplayToggle(): void {
    this.apply();
  }

  resetDefaults(): void {
    this.prefs = this.debugSettings.update({
      masterEnabled: true,
      overlays: {
        worldAxes: true,
        shipAxes: true,
        playVolumeGrid: true,
        navPaths: true,
        navWaypoints: true,
        wanderZones3d: true,
        npcRadarRings: true,
        npcSteeringVectors: true,
        playerAimVectors: true,
        playerRadarRing: true,
        vehicleWireframes: true,
        projectileGizmos: true,
        meteorWireframes: true,
      },
      labels: {
        enabled: true,
        vehicles: true,
        projectiles: true,
        navWaypoints: true,
        navPaths: true,
        wanderZones: true,
        meteors: true,
        npcActors: true,
      },
      gameplay: { invincible: true },
    });
    this.debugChange.emit(this.prefs);
  }
}
