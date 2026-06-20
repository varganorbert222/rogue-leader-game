import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  countAtlasCells,
  getParticleTextureEntry,
  isAnimatedParticleAtlas,
  resolveAlbedoTextureUrl,
  syncStaticAtlasCell,
  type ParticleSystemEditable,
  type ParticleTextureEntry,
} from '@rogue-leader/engine/dev';
import { DevColorFieldComponent } from '../../../../shared/dev-editor/dev-color-field/dev-color-field.component';
import { DevHdrColorFieldComponent } from '../../../../shared/dev-editor/dev-hdr-color-field/dev-hdr-color-field.component';
import { DevVec3FieldComponent } from '../../../../shared/dev-editor/dev-vec3-field/dev-vec3-field.component';
import { ParticleAtlasPickerComponent } from '../particle-atlas-picker/particle-atlas-picker.component';
import { ParticleRotationOverLifetimeComponent } from '../particle-rotation-over-lifetime/particle-rotation-over-lifetime.component';
import { ParticleShapeInspectorComponent } from '../particle-shape-inspector/particle-shape-inspector.component';
import { ParticleSizeOverLifetimeComponent } from '../particle-size-over-lifetime/particle-size-over-lifetime.component';

@Component({
  selector: 'app-particle-system-inspector',
  standalone: true,
  imports: [
    FormsModule,
    DevColorFieldComponent,
    DevHdrColorFieldComponent,
    DevVec3FieldComponent,
    ParticleAtlasPickerComponent,
    ParticleShapeInspectorComponent,
    ParticleSizeOverLifetimeComponent,
    ParticleRotationOverLifetimeComponent,
  ],
  templateUrl: './particle-system-inspector.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleSystemInspectorComponent {
  @Input({ required: true }) system!: ParticleSystemEditable;
  @Input({ required: true }) particleTextures: ParticleTextureEntry[] = [];
  @Input() playing = false;
  @Input() readonly = false;
  @Input() siblingModules: { id: string; name: string }[] = [];

  @Output() systemChange = new EventEmitter<void>();
  @Output() durationChange = new EventEmitter<void>();
  @Output() loopingChange = new EventEmitter<void>();
  @Output() emissionModeChange = new EventEmitter<void>();
  @Output() albedoTextureChange = new EventEmitter<void>();
  @Output() atlasCellSelect = new EventEmitter<number>();
  @Output() setAtlasRangeEdge = new EventEmitter<'start' | 'end'>();
  @Output() playAll = new EventEmitter<void>();
  @Output() playModule = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();

  get resolvedAlbedoUrl(): string | null {
    if (!this.system.albedoTexture.textureId) return null;
    return resolveAlbedoTextureUrl(this.system.albedoTexture);
  }

  get isAtlasAnimated(): boolean {
    return isAnimatedParticleAtlas(this.system.albedoTexture);
  }

  get selectedAlbedoTextureEntry(): ParticleTextureEntry | undefined {
    const textureId = this.system.albedoTexture.textureId;
    if (!textureId) return undefined;
    return getParticleTextureEntry(textureId);
  }

  get albedoAtlasCellCount(): number {
    const entry = this.selectedAlbedoTextureEntry;
    const albedo = this.system.albedoTexture;
    if (!entry?.atlas) return 0;
    return countAtlasCells(entry.width, entry.height, albedo.tileWidth, albedo.tileHeight);
  }

  onAlbedoTextureIdChange(textureId: string): void {
    this.system.albedoTexture.textureId = textureId;
    if (!textureId) {
      this.system.albedoTexture.isAtlas = false;
    }
    this.albedoTextureChange.emit();
  }

  onAtlasCellSelect(index: number): void {
    this.system.albedoTexture.cellIndex = index;
    if (!isAnimatedParticleAtlas(this.system.albedoTexture)) {
      this.system.albedoTexture = syncStaticAtlasCell(this.system.albedoTexture);
    }
    this.atlasCellSelect.emit(index);
  }

  onSetAtlasRangeEdge(edge: 'start' | 'end'): void {
    if (edge === 'start') {
      this.system.albedoTexture.startCellIndex = this.system.albedoTexture.cellIndex;
    } else {
      this.system.albedoTexture.endCellIndex = this.system.albedoTexture.cellIndex;
    }

    if (this.system.albedoTexture.endCellIndex < this.system.albedoTexture.startCellIndex) {
      const swap = this.system.albedoTexture.startCellIndex;
      this.system.albedoTexture.startCellIndex = this.system.albedoTexture.endCellIndex;
      this.system.albedoTexture.endCellIndex = swap;
    }

    this.setAtlasRangeEdge.emit(edge);
  }

  addSubEmitter(): void {
    const first = this.siblingModules[0];
    if (!first) return;
    this.system.subEmitters = [
      ...this.system.subEmitters,
      {
        targetSystemId: first.id,
        trigger: 'death',
        probability: 1,
        inheritVelocity: false,
      },
    ];
    this.systemChange.emit();
  }

  removeSubEmitter(index: number): void {
    this.system.subEmitters = this.system.subEmitters.filter((_, i) => i !== index);
    this.systemChange.emit();
  }

  onRenderModeChange(): void {
    this.systemChange.emit();
  }

  onBlendModeChange(): void {
    if (this.system.blendMode !== 'alpha') {
      this.system.alphaCutoff = null;
    }
    this.systemChange.emit();
  }

  setAlphaCutoffEnabled(enabled: boolean): void {
    this.system.alphaCutoff = enabled ? 0.5 : null;
    this.systemChange.emit();
  }

  onAlphaCutoffChange(value: number | string | null): void {
    if (value === '' || value === null) {
      this.system.alphaCutoff = 0;
    } else {
      const n = typeof value === 'number' ? value : Number(value);
      this.system.alphaCutoff = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    }
    this.systemChange.emit();
  }
}
