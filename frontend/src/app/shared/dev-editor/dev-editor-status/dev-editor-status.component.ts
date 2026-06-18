import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-dev-editor-status',
  standalone: true,
  templateUrl: './dev-editor-status.component.html',
  styleUrl: './dev-editor-status.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevEditorStatusComponent {
  @Input() loading = false;
  @Input() loadingMessage = 'Loading…';
  @Input() errorMessage = '';
}
