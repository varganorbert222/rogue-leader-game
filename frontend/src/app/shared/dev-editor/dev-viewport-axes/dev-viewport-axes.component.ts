import { Component, inject, NgZone, signal, ViewEncapsulation } from '@angular/core';
import {
  computeViewportAxisGizmoLines,
  type ViewportAxisGizmoLine,
} from '@rogue-leader/engine';
import type { Camera } from '@babylonjs/core';

@Component({
  selector: 'app-dev-viewport-axes',
  standalone: true,
  templateUrl: './dev-viewport-axes.component.html',
  styleUrl: './dev-viewport-axes.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevViewportAxesComponent {
  private readonly zone = inject(NgZone);
  readonly lines = signal<ViewportAxisGizmoLine[]>([]);

  update(camera: Camera): void {
    const next = computeViewportAxisGizmoLines(camera);
    this.zone.run(() => this.lines.set(next));
  }
}
