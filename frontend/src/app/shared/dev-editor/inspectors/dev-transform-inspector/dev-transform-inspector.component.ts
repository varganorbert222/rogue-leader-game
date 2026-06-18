import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import type { DevNodeTransform, DevTransformGizmoMode } from '@rogue-leader/engine';
import { DevInspectorSectionComponent } from '../dev-inspector-section/dev-inspector-section.component';
import { DevVec3FieldComponent } from '../../dev-vec3-field/dev-vec3-field.component';

@Component({
  selector: 'app-dev-transform-inspector',
  standalone: true,
  imports: [DevInspectorSectionComponent, DevVec3FieldComponent],
  templateUrl: './dev-transform-inspector.component.html',
  styleUrl: './dev-transform-inspector.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevTransformInspectorComponent {
  @Input() title = 'Transform';
  @Input({ required: true }) transform!: DevNodeTransform;
  @Input() hint = 'Local position, rotation (deg), and scale relative to parent.';
  @Input() readonly = false;
  @Input() showGizmo = true;
  @Input() showScale = true;
  @Input() positionStep = 0.1;
  @Input() rotationStep = 1;
  @Input() scaleStep = 0.05;
  @Input() gizmoMode: DevTransformGizmoMode = 'none';

  @Output() transformChange = new EventEmitter<void>();
  @Output() gizmoModeChange = new EventEmitter<DevTransformGizmoMode>();

  setGizmoMode(mode: DevTransformGizmoMode): void {
    if (this.readonly) return;
    this.gizmoModeChange.emit(mode);
  }
}
