import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  cloneCurveKeyframes,
  normalizeCurveKeyframes,
  type CurveKeyframeEditable,
  type Vec3CurveKeyframeEditable,
  type Vec3Editable,
} from '@rogue-leader/engine/dev';
import { DevCurveEditorComponent } from '../dev-curve-editor/dev-curve-editor.component';

type CurveAxis = 'x' | 'y' | 'z';

@Component({
  selector: 'app-dev-vec3-curve-editor',
  standalone: true,
  imports: [FormsModule, UpperCasePipe, DevCurveEditorComponent],
  templateUrl: './dev-vec3-curve-editor.component.html',
  styleUrl: './dev-vec3-curve-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevVec3CurveEditorComponent implements OnInit, OnChanges {
  @Input({ required: true }) keyframes!: Vec3CurveKeyframeEditable[];
  @Input() valueLabel = 'Multiplier ×';
  @Output() keyframesChange = new EventEmitter<void>();

  selectedAxis: CurveAxis = 'z';
  axisKeyframes: CurveKeyframeEditable[] = [];

  readonly axes: CurveAxis[] = ['x', 'y', 'z'];

  ngOnInit(): void {
    this.syncAxisKeyframes();
  }

  ngOnChanges(): void {
    this.syncAxisKeyframes();
  }

  onAxisChange(axis: CurveAxis): void {
    this.selectedAxis = axis;
    this.syncAxisKeyframes();
  }

  onAxisCurveChange(): void {
    const normalized = normalizeCurveKeyframes(this.axisKeyframes);
    const byTime = new Map(this.keyframes.map((kf) => [kf.time, kf.value]));

    this.keyframes.length = 0;
    for (const scalar of normalized) {
      const existing = [...byTime.entries()].find(
        ([time]) => Math.abs(time - scalar.time) < 0.0001,
      )?.[1];
      const value: Vec3Editable = {
        x: existing?.x ?? 1,
        y: existing?.y ?? 1,
        z: existing?.z ?? 1,
      };
      value[this.selectedAxis] = scalar.value;
      this.keyframes.push({ time: scalar.time, value });
    }

    this.syncAxisKeyframes();
    this.keyframesChange.emit();
  }

  private syncAxisKeyframes(): void {
    this.axisKeyframes = cloneCurveKeyframes(
      this.keyframes.map((kf) => ({
        time: kf.time,
        value: kf.value[this.selectedAxis],
      })),
    );
  }
}
