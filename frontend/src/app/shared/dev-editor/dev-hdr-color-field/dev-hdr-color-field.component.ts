import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Vec3Editable } from '@rogue-leader/engine';
import { hdrVec3ToPicker, pickerToHdrVec3 } from './dev-editor.utils';

@Component({
  selector: 'app-dev-hdr-color-field',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dev-hdr-color-field.component.html',
  styleUrl: './dev-hdr-color-field.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevHdrColorFieldComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) color!: Vec3Editable;
  @Output() colorChange = new EventEmitter<void>();

  get hex(): string {
    return hdrVec3ToPicker(this.color).hex;
  }

  get intensity(): number {
    return hdrVec3ToPicker(this.color).intensity;
  }

  onHexChange(hex: string): void {
    const next = pickerToHdrVec3(hex, this.intensity);
    this.color.x = next.x;
    this.color.y = next.y;
    this.color.z = next.z;
    this.colorChange.emit();
  }

  onIntensityChange(intensity: number): void {
    const next = pickerToHdrVec3(this.hex, intensity);
    this.color.x = next.x;
    this.color.y = next.y;
    this.color.z = next.z;
    this.colorChange.emit();
  }
}
