import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SIZE_OVER_LIFETIME_PRESETS,
  cloneCurveKeyframes,
  type SizeOverLifetimeEditable,
} from '@rogue-leader/engine';
import { DevCurveEditorComponent } from '../../../../shared/dev-editor/dev-curve-editor/dev-curve-editor.component';

@Component({
  selector: 'app-particle-size-over-lifetime',
  standalone: true,
  imports: [FormsModule, DevCurveEditorComponent],
  templateUrl: './particle-size-over-lifetime.component.html',
  styleUrl: './particle-size-over-lifetime.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleSizeOverLifetimeComponent {
  @Input({ required: true }) sizeOverLifetime!: SizeOverLifetimeEditable;
  @Output() sizeOverLifetimeChange = new EventEmitter<void>();

  readonly presets = SIZE_OVER_LIFETIME_PRESETS;

  onModeChange(): void {
    this.emitChange();
  }

  onRangeChange(): void {
    this.sizeOverLifetime.rangeStart = Math.max(0, this.sizeOverLifetime.rangeStart);
    this.sizeOverLifetime.rangeEnd = Math.max(0, this.sizeOverLifetime.rangeEnd);
    this.emitChange();
  }

  applyPreset(presetId: string): void {
    const preset = this.presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    this.sizeOverLifetime.mode = 'curve';
    this.sizeOverLifetime.keyframes = cloneCurveKeyframes(preset.keyframes);
    this.emitChange();
  }

  onCurveChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.sizeOverLifetimeChange.emit();
  }
}
