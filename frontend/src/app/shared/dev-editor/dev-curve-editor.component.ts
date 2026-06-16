import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CurveKeyframeEditable } from '@rogue-leader/engine';
import { cloneCurveKeyframes, normalizeCurveKeyframes } from '@rogue-leader/engine';

const PAD_LEFT = 28;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const VIEW_W = 280;
const VIEW_H = 140;

@Component({
  selector: 'app-dev-curve-editor',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './dev-curve-editor.component.html',
  styleUrl: './dev-curve-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevCurveEditorComponent {
  @Input({ required: true }) keyframes!: CurveKeyframeEditable[];
  @Input() valueMin = 0;
  @Input() valueMax = 1.5;
  @Input() timeLabel = 'Lifetime';
  @Input() valueLabel = 'Size ×';
  @Output() keyframesChange = new EventEmitter<void>();

  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;

  selectedIndex = 0;
  private dragIndex: number | null = null;

  get plotW(): number {
    return VIEW_W - PAD_LEFT - PAD_RIGHT;
  }

  get plotH(): number {
    return VIEW_H - PAD_TOP - PAD_BOTTOM;
  }

  get sortedKeyframes(): CurveKeyframeEditable[] {
    return normalizeCurveKeyframes(this.keyframes);
  }

  get polylinePoints(): string {
    return this.sortedKeyframes
      .map((kf) => `${this.timeToX(kf.time)},${this.valueToY(kf.value)}`)
      .join(' ');
  }

  onPointPointerDown(index: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedIndex = index;
    this.dragIndex = index;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  onPointPointerMove(event: PointerEvent): void {
    if (this.dragIndex === null) return;
    this.applyPointerPosition(event, this.dragIndex);
  }

  onPointPointerUp(event: PointerEvent): void {
    if (this.dragIndex === null) return;
    (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    this.dragIndex = null;
    this.commitKeyframes();
  }

  onPlotPointerDown(event: PointerEvent): void {
    if (this.dragIndex !== null) return;
    const target = event.currentTarget as SVGSVGElement;
    const point = this.clientToPlot(target, event.clientX, event.clientY);
    if (!point) return;

    const next = cloneCurveKeyframes(this.sortedKeyframes);
    next.push({
      time: point.time,
      value: point.value,
    });
    this.replaceKeyframes(next);
    this.selectedIndex = normalizeCurveKeyframes(next).findIndex(
      (kf) => Math.abs(kf.time - point.time) < 0.001,
    );
  }

  onSelectedTimeChange(time: number): void {
    const next = cloneCurveKeyframes(this.sortedKeyframes);
    const current = next[this.selectedIndex];
    if (!current) return;
    current.time = time;
    this.replaceKeyframes(next);
  }

  onSelectedValueChange(value: number): void {
    const next = cloneCurveKeyframes(this.sortedKeyframes);
    const current = next[this.selectedIndex];
    if (!current) return;
    current.value = value;
    this.replaceKeyframes(next, false);
  }

  removeSelectedPoint(): void {
    if (this.sortedKeyframes.length <= 2) return;
    const next = cloneCurveKeyframes(this.sortedKeyframes);
    next.splice(this.selectedIndex, 1);
    this.replaceKeyframes(next);
    this.selectedIndex = Math.min(this.selectedIndex, next.length - 1);
  }

  timeToX(time: number): number {
    return PAD_LEFT + time * this.plotW;
  }

  valueToY(value: number): number {
    const range = Math.max(this.valueMax - this.valueMin, 0.001);
    const t = (value - this.valueMin) / range;
    return PAD_TOP + (1 - t) * this.plotH;
  }

  private applyPointerPosition(event: PointerEvent, index: number): void {
    const svg = (event.currentTarget as Element).closest('svg');
    if (!svg) return;
    const point = this.clientToPlot(svg, event.clientX, event.clientY);
    if (!point) return;

    const next = cloneCurveKeyframes(this.sortedKeyframes);
    const current = next[index];
    if (!current) return;

    const isEdge = index === 0 || index === next.length - 1;
    current.value = point.value;
    if (!isEdge) {
      current.time = point.time;
    }
    this.replaceKeyframes(next, false);
  }

  private clientToPlot(
    svg: Element,
    clientX: number,
    clientY: number,
  ): { time: number; value: number } | null {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = ((clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((clientY - rect.top) / rect.height) * VIEW_H;
    const time = (x - PAD_LEFT) / this.plotW;
    const valueRatio = 1 - (y - PAD_TOP) / this.plotH;
    const range = Math.max(this.valueMax - this.valueMin, 0.001);

    return {
      time: Math.min(1, Math.max(0, time)),
      value: Math.max(this.valueMin, this.valueMin + valueRatio * range),
    };
  }

  private replaceKeyframes(next: CurveKeyframeEditable[], normalize = true): void {
    const normalized = normalize ? normalizeCurveKeyframes(next) : next;
    this.keyframes.length = 0;
    this.keyframes.push(...normalized);
    this.keyframesChange.emit();
  }

  private commitKeyframes(): void {
    this.replaceKeyframes(cloneCurveKeyframes(this.keyframes));
  }
}
