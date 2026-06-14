import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BabylonHost,
  CockpitPreviewScene,
  defaultCockpitEditable,
  editableToManifestCockpit,
  listCockpitEditorShips,
  loadAssetManifest,
  RuntimePaths,
  type AssetManifest,
  type CockpitEditableConfig,
  type CockpitPreviewLiveState,
  type CockpitPreviewMotion,
  type LodEditorModelEntry,
} from '@rogue-leader/engine';

@Component({
  selector: 'app-cockpit-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './cockpit-editor.component.html',
  styleUrl: './cockpit-editor.component.scss',
})
export class CockpitEditorComponent implements OnInit, OnDestroy {
  @ViewChild('previewCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  ships: LodEditorModelEntry[] = [];
  selectedShipId = '';
  loading = true;
  loadingMessage = 'Loading manifest…';
  errorMessage = '';

  config: CockpitEditableConfig = defaultCockpitEditable({
    lod: [],
    scale: 1,
    colliderRadius: 1,
  });
  motion: CockpitPreviewMotion = { pitchRate: 0, yawRate: 0, thrust: 0 };
  lookYaw = 0;
  lookPitch = 0;
  live: CockpitPreviewLiveState = {
    shipPitchDeg: 0,
    shipYawDeg: 0,
    speed: 0,
    inputOffsetX: 0,
    inputOffsetY: 0,
    inputOffsetZ: 0,
    stickPitch: 0,
    stickYaw: 0,
    stickThrottle: 0,
  };
  exportJson = '';
  copyStatus = '';

  private host: BabylonHost | null = null;
  private preview: CockpitPreviewScene | null = null;
  private manifestShips: AssetManifest['ships'] = {};
  private reloadTimer: number | null = null;
  private keys = new Set<string>();

  async ngOnInit(): Promise<void> {
    try {
      const manifest = await loadAssetManifest(RuntimePaths.assetManifest);
      this.manifestShips = manifest.ships;
      this.ships = listCockpitEditorShips(manifest);
      if (this.ships.length > 0) {
        this.selectedShipId = this.ships[0].id;
      }

      this.host = await BabylonHost.create(this.canvasRef.nativeElement);
      this.preview = new CockpitPreviewScene(this.host);
      this.preview.setProgressCallback((message) => {
        this.loadingMessage = message;
      });

      this.host.startRenderLoop((dt) => {
        if (!this.preview) return;
        this.applyKeyboardMotion();
        this.preview.setPreviewMotion(this.motion);
        this.preview.setLookAround(this.lookYaw, this.lookPitch);
        this.live = this.preview.update(dt);
      });

      if (this.selectedShipId) {
        await this.selectShip(this.selectedShipId);
      } else {
        this.loading = false;
      }
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.reloadTimer != null) window.clearTimeout(this.reloadTimer);
    this.preview?.dispose();
    this.host?.dispose();
    this.preview = null;
    this.host = null;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.key.toLowerCase());
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }

  async onShipChange(shipId: string): Promise<void> {
    this.selectedShipId = shipId;
    await this.selectShip(shipId);
  }

  onConfigChange(): void {
    this.schedulePreviewRefresh();
    this.refreshExport();
  }

  copyExport(): void {
    void navigator.clipboard.writeText(this.exportJson).then(() => {
      this.copyStatus = 'Copied';
      window.setTimeout(() => (this.copyStatus = ''), 2000);
    });
  }

  private async selectShip(shipId: string): Promise<void> {
    const entry = this.manifestShips[shipId];
    if (!entry || !this.preview) return;
    this.motion = { pitchRate: 0, yawRate: 0, thrust: 0 };
    this.loading = true;
    this.config = defaultCockpitEditable(entry);
    try {
      await this.preview.loadShip(shipId, entry);
      this.preview.setEditableConfig(this.config);
      this.refreshExport();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private schedulePreviewRefresh(): void {
    if (this.reloadTimer != null) window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => {
      this.preview?.setEditableConfig(this.config);
      this.reloadTimer = null;
    }, 200);
  }

  private refreshExport(): void {
    const snippet = editableToManifestCockpit(this.config);
    this.exportJson = JSON.stringify({ cockpit: snippet }, null, 2);
  }

  private applyKeyboardMotion(): void {
    const pitch = (this.keys.has('s') ? 1 : 0) - (this.keys.has('w') ? 1 : 0);
    const yaw = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const thrust = this.keys.has('shift') ? 1 : this.keys.has('control') ? -1 : 0;
    this.motion = {
      pitchRate: pitch * 0.9,
      yawRate: yaw * 0.9,
      thrust,
    };
    const lookX = (this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('arrowleft') ? 1 : 0);
    const lookY = (this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('arrowdown') ? 1 : 0);
    if (lookX !== 0 || lookY !== 0) {
      this.lookYaw = Math.max(-3, Math.min(3, this.lookYaw + lookX * 0.02));
      this.lookPitch = Math.max(-2, Math.min(2, this.lookPitch + lookY * 0.02));
    }
  }
}
