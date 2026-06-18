import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Color4Editable } from '@rogue-leader/engine';
import { clamp01, color4ToHex, hexToRgb } from './dev-editor.utils';

@Component({
  selector: 'app-dev-color-field',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './dev-color-field.component.html',
  styleUrl: './dev-color-field.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevColorFieldComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) color!: Color4Editable;
  @Output() colorChange = new EventEmitter<void>();

  get hex(): string {
    return color4ToHex(this.color);
  }

  onHexChange(hex: string): void {
    const { r, g, b } = hexToRgb(hex);
    this.color.r = r;
    this.color.g = g;
    this.color.b = b;
    this.colorChange.emit();
  }

  onAlphaChange(alpha: number): void {
    this.color.a = clamp01(alpha);
    this.colorChange.emit();
  }
}
