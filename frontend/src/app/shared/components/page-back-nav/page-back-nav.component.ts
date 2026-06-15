import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudioBootstrapService } from '../../../core/services/audio-bootstrap.service';

export interface PageBackNavItem {
  label: string;
  /** Router path — omit to emit `action` instead. */
  route?: string | string[];
  /** Emitted on click when `route` is not set. */
  actionId?: string;
}

@Component({
  selector: 'app-page-back-nav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page-back-nav.component.html',
  styleUrl: './page-back-nav.component.scss',
})
export class PageBackNavComponent {
  @Input({ required: true }) items: PageBackNavItem[] = [];
  /** Tighter spacing for overlays (ship select, loading). */
  @Input() compact = false;

  @Output() action = new EventEmitter<string>();

  protected readonly audio = inject(AudioBootstrapService);

  onRouteClick(): void {
    this.audio.playUiBack();
  }

  onAction(id: string): void {
    this.audio.playUiBack();
    this.action.emit(id);
  }
}
