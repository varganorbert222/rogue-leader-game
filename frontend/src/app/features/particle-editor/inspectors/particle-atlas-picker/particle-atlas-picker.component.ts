import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  atlasCellColumn,
  atlasCellRow,
  countAtlasCells,
} from '@rogue-leader/engine';

interface AtlasGridCell {
  index: number;
  col: number;
  row: number;
}

@Component({
  selector: 'app-particle-atlas-picker',
  standalone: true,
  templateUrl: './particle-atlas-picker.component.html',
  styleUrl: './particle-atlas-picker.component.scss',
})
export class ParticleAtlasPickerComponent implements OnChanges {
  @Input() textureUrl: string | null = null;
  @Input() tileWidth = 128;
  @Input() tileHeight = 128;
  @Input() selectedIndex = 0;
  @Input() startIndex = 0;
  @Input() endIndex = 0;
  @Input() animated = false;

  @Output() cellSelect = new EventEmitter<number>();

  imageWidth = 0;
  imageHeight = 0;
  gridColumns = 1;
  cells: AtlasGridCell[] = [];
  loadFailed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['textureUrl'] ||
      changes['tileWidth'] ||
      changes['tileHeight']
    ) {
      this.loadImageMetrics();
    } else {
      this.rebuildCells();
    }
  }

  isSelected(cell: AtlasGridCell): boolean {
    if (this.animated) {
      return cell.index >= this.startIndex && cell.index <= this.endIndex;
    }
    return cell.index === this.selectedIndex;
  }

  isPrimary(cell: AtlasGridCell): boolean {
    return cell.index === this.selectedIndex;
  }

  onCellClick(cell: AtlasGridCell): void {
    this.cellSelect.emit(cell.index);
  }

  private loadImageMetrics(): void {
    this.cells = [];
    this.imageWidth = 0;
    this.imageHeight = 0;
    this.loadFailed = false;

    if (!this.textureUrl) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      this.imageWidth = image.naturalWidth;
      this.imageHeight = image.naturalHeight;
      this.rebuildCells();
    };
    image.onerror = () => {
      this.loadFailed = true;
      this.cells = [];
    };
    image.src = this.textureUrl;
  }

  private rebuildCells(): void {
    if (!this.textureUrl || this.imageWidth <= 0 || this.imageHeight <= 0) {
      this.cells = [];
      return;
    }

    const total = countAtlasCells(
      this.imageWidth,
      this.imageHeight,
      this.tileWidth,
      this.tileHeight,
    );

    this.gridColumns = Math.max(1, Math.floor(this.imageWidth / Math.max(1, this.tileWidth)));

    this.cells = Array.from({ length: total }, (_, index) => ({
      index,
      col: atlasCellColumn(index, this.imageWidth, this.tileWidth),
      row: atlasCellRow(index, this.imageWidth, this.tileWidth),
    }));
  }
}
