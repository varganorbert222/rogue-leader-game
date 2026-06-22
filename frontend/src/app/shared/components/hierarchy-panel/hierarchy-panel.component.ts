import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
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
} from '@rogue-leader/engine/dev';

export type HierarchyContextAction =
  | 'addCatalog'
  | 'addBlank'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'delete';

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
  @Input() treeReorder = false;
  @Input() showRowActions = false;
  @Input() emptyMessage = 'No nodes';
  @Input() resetKey: string | number = 0;
  @Input() syncViewport = false;
  @Input() canRemoveNode: (node: HierarchyNode) => boolean = () => false;
  @Input() showRootActions = false;
  @Input() canAddBelowNode: (node: HierarchyNode) => boolean = () => true;
  @Input() canDragNode: (node: HierarchyNode) => boolean = () => true;
  @Input() showClipboardActions = false;
  @Input() clipboardReady = false;
  @Input() canCopyNode: (node: HierarchyNode) => boolean = () => false;
  @Input() canCutNode: (node: HierarchyNode) => boolean = () => false;
  @Input() canPasteIntoNode: (node: HierarchyNode) => boolean = () => false;
  @Input() showGeneratedBadge = true;

  @Output() nodeSelect = new EventEmitter<HierarchyNode>();
  @Output() nodeReorder = new EventEmitter<HierarchyReorderEvent>();
  @Output() viewportVisibilityChange =
    new EventEmitter<HierarchyOutlinerState>();
  @Output() addBelow = new EventEmitter<HierarchyNode>();
  @Output() addAtRoot = new EventEmitter<void>();
  @Output() removeNode = new EventEmitter<HierarchyNode>();
  @Output() contextAction = new EventEmitter<{
    action: HierarchyContextAction;
    node: HierarchyNode;
  }>();

  rows: HierarchyOutlinerRow[] = [];
  outlinerState: HierarchyOutlinerState = createHierarchyOutlinerState();

  contextMenu: { x: number; y: number; node: HierarchyNode } | null = null;
  dropHintId = '';
  dropHintPosition: HierarchyReorderEvent['position'] | '' = '';

  private dragSourceId = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] || changes['resetKey']) {
      this.resetOutliner();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.contextMenu = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.contextMenu = null;
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
    this.contextMenu = null;
    this.nodeSelect.emit(node);
  }

  onRowContextMenu(row: HierarchyOutlinerRow, event: MouseEvent): void {
    if (!this.showRowActions) return;
    event.preventDefault();
    event.stopPropagation();
    this.nodeSelect.emit(row.node);
    this.contextMenu = { x: event.clientX, y: event.clientY, node: row.node };
  }

  onVisibilityClick(row: HierarchyOutlinerRow, event: MouseEvent): void {
    event.stopPropagation();
    toggleNodeViewportVisibility(row.node, this.outlinerState);
    this.rebuildRows();
    this.emitViewportState();
  }

  onAddClick(node: HierarchyNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canAddBelowNode(node)) return;
    this.contextMenu = null;
    this.addBelow.emit(node);
  }

  onAddAtRootClick(event: MouseEvent): void {
    event.stopPropagation();
    this.contextMenu = null;
    this.addAtRoot.emit();
  }

  onRemoveClick(node: HierarchyNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canRemoveNode(node)) return;
    this.contextMenu = null;
    this.removeNode.emit(node);
  }

  onContextPick(action: HierarchyContextAction): void {
    if (!this.contextMenu) return;
    const node = this.contextMenu.node;
    this.contextMenu = null;
    this.contextAction.emit({ action, node });
  }

  canDrag(row: HierarchyOutlinerRow): boolean {
    if (!this.editable) return false;
    if (!this.canDragNode(row.node)) return false;
    if (this.treeReorder) {
      return true;
    }
    if (this.flatReorderUnderRoot) {
      return row.depth === 1 && row.node.kind === 'particleSystem';
    }
    return false;
  }

  canDropInside(row: HierarchyOutlinerRow): boolean {
    if (!this.canAddBelowNode(row.node)) return false;
    return (
      this.treeReorder &&
      (row.node.kind === 'effectGroup' ||
        row.node.kind === 'prefabGroup' ||
        row.hasChildren)
    );
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
    if (
      !this.editable ||
      !this.dragSourceId ||
      this.dragSourceId === row.node.id
    )
      return;
    if (!this.canDrag(row) && !this.treeReorder) return;

    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    const h = rect.height;
    let position: HierarchyReorderEvent['position'];
    if (this.treeReorder && this.canDropInside(row)) {
      if (y < h * 0.25) position = 'before';
      else if (y > h * 0.75) position = 'after';
      else position = 'inside';
    } else {
      position = y < h * 0.5 ? 'before' : 'after';
    }
    this.dropHintId = row.node.id;
    this.dropHintPosition = position;
  }

  onDragLeave(): void {
    this.dropHintId = '';
    this.dropHintPosition = '';
  }

  onDrop(row: HierarchyOutlinerRow, event: DragEvent): void {
    event.preventDefault();
    const sourceId =
      this.dragSourceId || event.dataTransfer?.getData('text/plain');
    this.dropHintId = '';
    this.dropHintPosition = '';

    if (!sourceId || sourceId === row.node.id) {
      this.dragSourceId = '';
      return;
    }

    if (!this.treeReorder && !this.canDrag(row)) {
      this.dragSourceId = '';
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const y = event.clientY - rect.top;
    const h = rect.height;
    let position: HierarchyReorderEvent['position'];
    if (this.treeReorder && this.canDropInside(row)) {
      if (y < h * 0.25) position = 'before';
      else if (y > h * 0.75) position = 'after';
      else position = 'inside';
    } else {
      position = y < h * 0.5 ? 'before' : 'after';
    }

    this.nodeReorder.emit({ sourceId, targetId: row.node.id, position });
    this.dragSourceId = '';
  }

  onDragEnd(): void {
    this.dragSourceId = '';
    this.dropHintId = '';
    this.dropHintPosition = '';
  }

  kindIcon(kind: string): string {
    switch (kind) {
      case 'mesh':
        return '\u25C6';
      case 'transform':
        return '\u25B8';
      case 'empty':
        return '\u25CB';
      case 'collider':
        return '\u2B21';
      case 'particleSystem':
        return '\u2726';
      case 'effectGroup':
        return '\u25A3';
      case 'prefabGroup':
        return '\u25A3';
      case 'prefabModel':
        return '\u25C6';
      case 'sceneNode':
        return '\u25C7';
      default:
        return '\u2022';
    }
  }

  presetRefBadgeLabel(mode: 'readonly' | 'edit'): string {
    return mode === 'readonly' ? 'ref' : 'linked';
  }

  presetRefBadgeTitle(mode: 'readonly' | 'edit'): string {
    return mode === 'readonly'
      ? 'Catalog reference (read-only)'
      : 'Catalog reference (linked edit)';
  }

  private rebuildRows(): void {
    this.rows = flattenOutlinerHierarchy(this.nodes, this.outlinerState);
  }

  private emitViewportState(): void {
    if (!this.syncViewport) return;
    this.viewportVisibilityChange.emit(
      cloneHierarchyOutlinerState(this.outlinerState),
    );
  }
}
