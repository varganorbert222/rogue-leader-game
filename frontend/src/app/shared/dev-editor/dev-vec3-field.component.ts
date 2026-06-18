import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Vec3Editable } from '@rogue-leader/engine';

@Component({
  selector: 'app-dev-vec3-field',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dev-vec3-field.component.html',
  styleUrl: './dev-vec3-field.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevVec3FieldComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) vector!: Vec3Editable;
  @Input() min: number | null = null;
  @Input() step = 0.1;
  @Output() vectorChange = new EventEmitter<void>();

  onChange(axis: 'x' | 'y' | 'z', value: number | string | null): void {
    if (value === '' || value === null) {
      return;
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
      return;
    }
    this.vector[axis] = this.min !== null ? Math.max(this.min, n) : n;
    this.vectorChange.emit();
  }

  onBlur(axis: 'x' | 'y' | 'z'): void {
    if (!Number.isFinite(this.vector[axis])) {
      this.vector[axis] = this.min !== null ? this.min : 0;
      this.vectorChange.emit();
    }
  }
}
