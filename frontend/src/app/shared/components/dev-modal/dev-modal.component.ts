import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-dev-modal',
  standalone: true,
  templateUrl: './dev-modal.component.html',
  styleUrl: './dev-modal.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() titleId = 'dev-modal-title';
  @Input() closeOnBackdrop = true;

  @Output() dismiss = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop) return;
    if ((event.target as HTMLElement).classList.contains('dev-modal-backdrop')) {
      this.dismiss.emit();
    }
  }
}
