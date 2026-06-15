import { Component, Input, ViewEncapsulation } from '@angular/core';
import { copyJsonToClipboard } from './dev-editor.utils';

@Component({
  selector: 'app-dev-json-export',
  standalone: true,
  templateUrl: './dev-json-export.component.html',
  styleUrl: './dev-json-export.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevJsonExportComponent {
  @Input() title = 'Export';
  @Input() json = '';
  @Input() rows = 8;
  @Input() hint = '';

  copyStatus = '';

  async copy(): Promise<void> {
    const result = await copyJsonToClipboard(this.json);
    this.copyStatus = result === 'ok' ? 'Copied to clipboard' : 'Copy failed — select JSON manually';
    window.setTimeout(() => {
      this.copyStatus = '';
    }, 2500);
  }
}
