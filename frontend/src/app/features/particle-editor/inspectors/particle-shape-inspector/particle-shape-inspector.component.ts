import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ParticleShapeEditable, ParticleShapeType } from '@rogue-leader/engine/dev';
import { DevVec3FieldComponent } from '../../../../shared/dev-editor/dev-vec3-field/dev-vec3-field.component';
const SHAPE_LABELS: Record<ParticleShapeType, string> = {
  point: 'Point',
  line: 'Line',
  box: 'Box',
  sphere: 'Sphere',
  hemisphere: 'Hemisphere',
  capsule: 'Capsule',
  donut: 'Donut',
};

@Component({
  selector: 'app-particle-shape-inspector',
  standalone: true,
  imports: [FormsModule, DevVec3FieldComponent],
  templateUrl: './particle-shape-inspector.component.html',
  styleUrl: './particle-shape-inspector.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleShapeInspectorComponent {
  @Input({ required: true }) shape!: ParticleShapeEditable;
  @Output() shapeChange = new EventEmitter<void>();

  readonly shapeTypes: ParticleShapeType[] = [
    'point',
    'line',
    'box',
    'sphere',
    'hemisphere',
    'capsule',
    'donut',
  ];

  shapeLabel(type: ParticleShapeType): string {
    return SHAPE_LABELS[type];
  }

  onTypeChange(type: ParticleShapeType): void {
    this.shape.type = type;
    this.shapeChange.emit();
  }

  onFieldChange(): void {
    if (this.shape.type === 'box') {
      this.shape.boxMax.x = Math.max(0, this.shape.boxMax.x);
      this.shape.boxMax.y = Math.max(0, this.shape.boxMax.y);
      this.shape.boxMax.z = Math.max(0, this.shape.boxMax.z);
      this.shape.boxMin.x = -this.shape.boxMax.x;
      this.shape.boxMin.y = -this.shape.boxMax.y;
      this.shape.boxMin.z = -this.shape.boxMax.z;
    }
    this.shape.radius = Math.max(0, this.shape.radius);
    this.shape.length = Math.max(0, this.shape.length);
    this.shape.tubeRadius = Math.max(0, this.shape.tubeRadius);
    this.shapeChange.emit();
  }
  /** Icon-space radius (viewBox 0–100, center 50). */
  get iconR(): number {
    return this.iconDim(this.shape.radius, 1.5, 20, 28);
  }

  get iconLen(): number {
    return this.iconDim(this.shape.length, 2, 24, 46);
  }

  get iconTube(): number {
    return this.iconDim(this.shape.tubeRadius, 0.5, 7, 12);
  }

  get iconBoxW(): number {
    return this.iconDim(Math.abs(this.shape.boxMax.x), 1.5, 22, 38);
  }

  get iconBoxH(): number {
    return this.iconDim(Math.abs(this.shape.boxMax.y), 1.5, 22, 38);
  }

  get iconDonutOuter(): number {
    return this.iconR + this.iconTube;
  }

  get iconDonutInner(): number {
    return Math.max(this.iconDonutOuter - this.iconTube * 1.6, 9);
  }

  hemispherePath(): string {
    const r = this.iconR;
    return `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50 Z`;
  }

  private iconDim(value: number, ref: number, min: number, max: number): number {
    const ratio = Math.abs(value) / ref;
    const t = ratio <= 0 ? 0.2 : Math.min(1, 0.2 + (0.8 * Math.min(ratio, 8)) / 8);
    return min + t * (max - min);
  }}
