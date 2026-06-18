import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import type { SelectableShipInfo } from '@rogue-leader/game';
import {
  PageBackNavComponent,
  type PageBackNavItem,
} from '../../../shared/components/page-back-nav/page-back-nav.component';

@Component({
  selector: 'app-ship-select-overlay',
  standalone: true,
  imports: [PageBackNavComponent],
  templateUrl: './ship-select-overlay.component.html',
  styleUrl: './ship-select-overlay.component.scss',
})
export class ShipSelectOverlayComponent implements OnDestroy, OnChanges {
  @ViewChild('previewCanvas', { static: true })
  previewCanvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) ships: SelectableShipInfo[] = [];
  @Input() title = 'Choose your fighter';
  @Input() subtitle = 'Faction is determined by ship type.';

  @Output() previewShip = new EventEmitter<string>();
  @Output() confirmShip = new EventEmitter<string>();
  @Output() backNavigate = new EventEmitter<'mission-select' | 'main-menu'>();
  @Output() previewReady = new EventEmitter<HTMLCanvasElement>();

  readonly backLinks: PageBackNavItem[] = [
    { label: '← Mission Select', actionId: 'mission-select' },
    { label: '← Main Menu', actionId: 'main-menu' },
  ];

  selectedShipId: string | null = null;

  constructor() {
    afterNextRender(() => {
      this.previewReady.emit(this.previewCanvasRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    // Preview lifecycle owned by MissionManager.
  }

  ngOnChanges(): void {
    if (!this.selectedShipId && this.ships.length > 0) {
      this.selectShip(this.ships[0]);
    }
  }

  selectShip(ship: SelectableShipInfo): void {
    this.selectedShipId = ship.shipId;
    this.previewShip.emit(ship.shipId);
  }

  launch(): void {
    if (!this.selectedShipId) return;
    this.confirmShip.emit(this.selectedShipId);
  }

  onBackNavigate(actionId: string): void {
    if (actionId === 'mission-select' || actionId === 'main-menu') {
      this.backNavigate.emit(actionId);
    }
  }
}
