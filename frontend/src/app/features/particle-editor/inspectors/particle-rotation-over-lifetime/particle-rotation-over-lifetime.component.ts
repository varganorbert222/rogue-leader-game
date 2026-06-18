import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ROTATION_OVER_LIFETIME_PRESETS,
  cloneVec3CurveKeyframes,
  type RotationOverLifetimeEditable,
} from '@rogue-leader/engine';
import { DevVec3CurveEditorComponent } from '../../../../shared/dev-editor/dev-vec3-curve-editor/dev-vec3-curve-editor.component';
import { DevVec3FieldComponent } from '../../../../shared/dev-editor/dev-vec3-field/dev-vec3-field.component';

@Component({
  selector: 'app-particle-rotation-over-lifetime',
  standalone: true,
  imports: [FormsModule, DevVec3FieldComponent, DevVec3CurveEditorComponent],
  templateUrl: './particle-rotation-over-lifetime.component.html',
  styleUrl: './particle-rotation-over-lifetime.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleRotationOverLifetimeComponent {
  @Input({ required: true }) rotationOverLifetime!: RotationOverLifetimeEditable;
  @Output() rotationOverLifetimeChange = new EventEmitter<void>();

  readonly presets = ROTATION_OVER_LIFETIME_PRESETS;

  onModeChange(): void {
    this.emitChange();
  }

  onRangeChange(): void {
    this.emitChange();
  }

  applyPreset(presetId: string): void {
    const preset = this.presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    this.rotationOverLifetime.mode = 'curve';
    this.rotationOverLifetime.keyframes = cloneVec3CurveKeyframes(preset.keyframes);
    this.emitChange();
  }

  onCurveChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.rotationOverLifetimeChange.emit();
  }
}
