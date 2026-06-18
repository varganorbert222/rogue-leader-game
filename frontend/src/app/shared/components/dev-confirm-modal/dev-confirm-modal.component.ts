import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { DevModalComponent } from '../dev-modal/dev-modal.component';

@Component({
  selector: 'app-dev-confirm-modal',
  standalone: true,
  imports: [DevModalComponent],
  templateUrl: './dev-confirm-modal.component.html',
  styleUrl: './dev-confirm-modal.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevConfirmModalComponent {
  @Input() open = false;
  @Input() title = 'Confirm';
  @Input() message = '';
  @Input() detail = '';
  @Input() confirmLabel = 'OK';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'default' | 'danger' = 'default';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  get confirmButtonClass(): string {
    return this.variant === 'danger' ? 'danger-btn' : 'primary-btn';
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
