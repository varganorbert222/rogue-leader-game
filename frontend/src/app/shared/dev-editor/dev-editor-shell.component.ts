import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DevEditorCanvases } from './dev-editor.utils';
import { DevViewportAxesComponent } from './dev-viewport-axes.component';

export type DevEditorBadge = 'dev' | 'view' | null;

@Component({
  selector: 'app-dev-editor-shell',
  standalone: true,
  imports: [RouterLink, DevViewportAxesComponent],
  templateUrl: './dev-editor-shell.component.html',
  styleUrl: './dev-editor-shell.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevEditorShellComponent implements AfterViewInit {
  @Input() title = 'Editor';
  @Input() badge: DevEditorBadge = 'dev';
  @Input() leftTitle = '';
  @Input() rightTitle = '';

  @ViewChild('previewCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild(DevViewportAxesComponent, { static: true })
  axisGizmo!: DevViewportAxesComponent;

  @Output() canvasReady = new EventEmitter<DevEditorCanvases>();

  ngAfterViewInit(): void {
    this.canvasReady.emit({
      preview: this.canvasRef.nativeElement,
      updateAxisGizmo: (camera) => this.axisGizmo.update(camera),
    });
  }
}
