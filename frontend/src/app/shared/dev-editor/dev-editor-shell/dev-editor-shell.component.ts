import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DevEditorCanvases } from '../utils/dev-editor.utils';
import { DevViewportAxesComponent } from '../dev-viewport-axes/dev-viewport-axes.component';

export type DevEditorBadge = 'dev' | 'view' | null;

const PANEL_WIDTH_KEY = 'dev-editor-panel-widths';
const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH_RATIO = 0.45;

@Component({
  selector: 'app-dev-editor-shell',
  standalone: true,
  imports: [RouterLink, DevViewportAxesComponent],
  templateUrl: './dev-editor-shell.component.html',
  styleUrl: './dev-editor-shell.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevEditorShellComponent implements AfterViewInit, OnDestroy {
  @Input() title = 'Editor';
  @Input() badge: DevEditorBadge = 'dev';
  @Input() leftTitle = '';
  @Input() rightTitle = '';

  @ViewChild('previewCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild(DevViewportAxesComponent, { static: true })
  axisGizmo!: DevViewportAxesComponent;

  @Output() canvasReady = new EventEmitter<DevEditorCanvases>();

  leftWidth = DEFAULT_PANEL_WIDTH;
  rightWidth = DEFAULT_PANEL_WIDTH;

  private resizeState: { side: 'left' | 'right'; startX: number; startWidth: number } | null =
    null;
  private readonly onMove = (event: MouseEvent) => this.handleResize(event);
  private readonly onUp = () => this.endResize();

  constructor() {
    this.restorePanelWidths();
  }

  ngAfterViewInit(): void {
    this.canvasReady.emit({
      preview: this.canvasRef.nativeElement,
      updateAxisGizmo: (camera) => this.axisGizmo.update(camera),
    });
  }

  ngOnDestroy(): void {
    this.endResize();
  }

  startResize(side: 'left' | 'right', event: MouseEvent): void {
    event.preventDefault();
    this.resizeState = {
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? this.leftWidth : this.rightWidth,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
  }

  private handleResize(event: MouseEvent): void {
    if (!this.resizeState) return;

    const dx = event.clientX - this.resizeState.startX;
    const maxWidth = Math.floor(window.innerWidth * MAX_PANEL_WIDTH_RATIO);

    if (this.resizeState.side === 'left') {
      this.leftWidth = this.clampPanelWidth(this.resizeState.startWidth + dx, maxWidth);
    } else {
      this.rightWidth = this.clampPanelWidth(this.resizeState.startWidth - dx, maxWidth);
    }
  }

  private endResize(): void {
    if (!this.resizeState) return;
    this.resizeState = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.persistPanelWidths();
  }

  private clampPanelWidth(width: number, maxWidth: number): number {
    return Math.max(MIN_PANEL_WIDTH, Math.min(width, maxWidth));
  }

  private restorePanelWidths(): void {
    try {
      const raw = localStorage.getItem(PANEL_WIDTH_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { left?: number; right?: number };
      const maxWidth = Math.floor(window.innerWidth * MAX_PANEL_WIDTH_RATIO);
      if (typeof parsed.left === 'number') {
        this.leftWidth = this.clampPanelWidth(parsed.left, maxWidth);
      }
      if (typeof parsed.right === 'number') {
        this.rightWidth = this.clampPanelWidth(parsed.right, maxWidth);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private persistPanelWidths(): void {
    try {
      localStorage.setItem(
        PANEL_WIDTH_KEY,
        JSON.stringify({ left: this.leftWidth, right: this.rightWidth }),
      );
    } catch {
      // ignore quota / privacy mode
    }
  }
}
