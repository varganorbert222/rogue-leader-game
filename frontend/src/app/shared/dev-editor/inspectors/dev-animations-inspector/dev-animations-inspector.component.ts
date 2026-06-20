import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import type { DevPreviewAnimationInfo } from '@rogue-leader/engine/dev';
import { DevInspectorSectionComponent } from '../dev-inspector-section/dev-inspector-section.component';

@Component({
  selector: 'app-dev-animations-inspector',
  standalone: true,
  imports: [DevInspectorSectionComponent],
  templateUrl: './dev-animations-inspector.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class DevAnimationsInspectorComponent {
  @Input() animations: DevPreviewAnimationInfo[] = [];
  @Input() playingAnimationIndex: number | null = null;

  @Output() playAnimation = new EventEmitter<number>();
  @Output() stopAnimations = new EventEmitter<void>();
}
