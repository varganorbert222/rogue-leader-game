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

  onChange(): void {
    if (this.min !== null) {
      this.vector.x = Math.max(this.min, this.vector.x);
      this.vector.y = Math.max(this.min, this.vector.y);
      this.vector.z = Math.max(this.min, this.vector.z);
    }
    this.vectorChange.emit();
  }
}
