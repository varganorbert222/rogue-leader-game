import { Component, Input, ViewEncapsulation } from '@angular/core';
import { copyJsonToClipboard } from '../utils/dev-editor.utils';

@Component({
  selector: 'app-dev-json-copy',
  standalone: true,
  templateUrl: './dev-json-copy.component.html',
  styleUrl: './dev-json-copy.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevJsonCopyComponent {
  @Input() title = 'Export';
  @Input() data: unknown = null;
  @Input() beforeCopy?: () => void;

  copying = false;
  status = '';
  statusError = false;

  async copy(): Promise<void> {
    if (this.data == null) {
      this.setStatus('Nothing to copy.', true);
      return;
    }

    this.copying = true;
    this.status = '';
    try {
      this.beforeCopy?.();
      await copyJsonToClipboard(this.data);
      this.setStatus('Copied to clipboard.', false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus(message, true);
    } finally {
      this.copying = false;
    }
  }

  private setStatus(message: string, isError: boolean): void {
    this.status = message;
    this.statusError = isError;
    window.setTimeout(() => {
      this.status = '';
    }, 3500);
  }
}
