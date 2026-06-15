import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import {
  cloneHierarchyOutlinerState,
  createHierarchyOutlinerState,
  flattenOutlinerHierarchy,
  seedExpandedHierarchyNodes,
  toggleNodeViewportVisibility,
  type HierarchyNode,
  type HierarchyOutlinerRow,
  type HierarchyOutlinerState,
  type HierarchyReorderEvent,
} from '@rogue-leader/engine';

@Component({
  selector: 'app-hierarchy-panel',
  standalone: true,
  templateUrl: './hierarchy-panel.component.html',
  styleUrl: './hierarchy-panel.component.scss',
})
export class HierarchyPanelComponent implements OnChanges {
  @Input() title = 'Hierarchy';
  @Input() nodes: HierarchyNode[] = [];
  @Input() selectedId = '';
  @Input() editable = false;
  @Input() flatReorderUnderRoot = false;
  @Input() emptyMessage = 'No nodes';
  /** Bumps when the viewed model changes — forces a full panel reset. */
  @Input() resetKey: string | number = 0;
  /** Sync viewport visibility to the 3D preview (scene graph editors). */
  @Input() syncViewport = false;

  @Output() nodeSelect = new EventEmitter<HierarchyNode>();
  @Output() nodeReorder = new EventEmitter<HierarchyReorderEvent>();
  @Output() viewportVisibilityChange = new EventEmitter<HierarchyOutlinerState>();

  rows: HierarchyOutlinerRow[] = [];
  outlinerState: HierarchyOutlinerState = createHierarchyOutlinerState();

  private dragSourceId = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] || changes['resetKey']) {
      this.resetOutliner();
    }
  }

  private resetOutliner(): void {
    this.outlinerState.overrides.clear();
    this.outlinerState.expanded.clear();
    seedExpandedHierarchyNodes(this.nodes, this.outlinerState.expanded);
    this.rebuildRows();
    this.emitViewportState();
  }

  toggleExpanded(nodeId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.outlinerState.expanded.has(nodeId)) {
      this.outlinerState.expanded.delete(nodeId);
    } else {
      this.outlinerState.expanded.add(nodeId);
    }
    this.rebuildRows();
  }

  isExpanded(nodeId: string): boolean {
    return this.outlinerState.expanded.has(nodeId);
  }

  onNodeClick(node: HierarchyNode): void {
    this.nodeSelect.emit(node);
  }

  onVisibilityClick(row: HierarchyOutlinerRow, event: MouseEvent): void {
    event.stopPropagation();
    toggleNodeViewportVisibility(row.node, this.outlinerState);
    this.rebuildRows();
    this.emitViewportState();
  }

  canDrag(row: HierarchyOutlinerRow): boolean {
    if (!this.editable) return false;
    if (this.flatReorderUnderRoot) {
      return row.depth === 1 && row.node.kind === 'particleSystem';
    }
    return false;
  }

  onDragStart(row: HierarchyOutlinerRow, event: DragEvent): void {
    if (!this.canDrag(row)) {
      event.preventDefault();
      return;
    }
    this.dragSourceId = row.node.id;
    event.dataTransfer?.setData('text/plain', row.node.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragOver(row: HierarchyOutlinerRow, event: DragEvent): void {
    if (!this.editable || !this.dragSourceId || this.dragSourceId === row.node.id) return;
    if (!this.canDrag(row)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDrop(row: HierarchyOutlinerRow, event: DragEvent): void {
    event.preventDefault();
    const sourceId = this.dragSourceId || event.dataTransfer?.getData('text/plain');
    if (!sourceId || sourceId === row.node.id || !this.canDrag(row)) {
      this.dragSourceId = '';
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' =
      event.clientY < rect.top + rect.height * 0.5 ? 'before' : 'after';

    this.nodeReorder.emit({ sourceId, targetId: row.node.id, position });
    this.dragSourceId = '';
  }

  onDragEnd(): void {
    this.dragSourceId = '';
  }

  kindIcon(kind: string): string {
    switch (kind) {
      case 'mesh':
        return '◆';
      case 'transform':
        return '▸';
      case 'empty':
        return '○';
      case 'collider':
        return '⬡';
      case 'particleSystem':
        return '✦';
      case 'effectRoot':
        return '◎';
      default:
        return '•';
    }
  }

  private rebuildRows(): void {
    this.rows = flattenOutlinerHierarchy(this.nodes, this.outlinerState);
  }

  private emitViewportState(): void {
    if (!this.syncViewport) return;
    this.viewportVisibilityChange.emit(cloneHierarchyOutlinerState(this.outlinerState));
  }
}
