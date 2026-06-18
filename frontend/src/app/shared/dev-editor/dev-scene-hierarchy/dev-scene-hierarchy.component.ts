import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import type { HierarchyNode, HierarchyOutlinerState } from '@rogue-leader/engine';
import { HierarchyPanelComponent } from '../../components/hierarchy-panel/hierarchy-panel.component';

@Component({
  selector: 'app-dev-scene-hierarchy',
  standalone: true,
  imports: [HierarchyPanelComponent],
  templateUrl: './dev-scene-hierarchy.component.html',
  styleUrl: './dev-scene-hierarchy.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevSceneHierarchyComponent {
  @Input() title = 'Model hierarchy';
  @Input() resetKey: string | number = 0;
  @Input() nodes: HierarchyNode[] = [];
  @Input() selectedId = '';
  @Input() emptyMessage = 'Load a model to inspect its hierarchy';

  @Output() nodeSelect = new EventEmitter<HierarchyNode>();
  @Output() viewportVisibilityChange = new EventEmitter<HierarchyOutlinerState>();
}
