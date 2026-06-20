import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  LodEditorModelEntry,
  ParticlePresetEntry,
  PrefabLibraryEntry,
} from '@rogue-leader/engine/dev';
import { listParticlePresetOptionsForPrefab } from '@rogue-leader/engine/dev';
import { DevModalComponent } from '../../../../shared/components/dev-modal/dev-modal.component';
import { DevModelPickerComponent } from '../../../../shared/dev-editor/dev-model-picker/dev-model-picker.component';
import {
  findModelEntry,
  firstVariantId,
} from '../../../../shared/dev-editor/utils/dev-editor.utils';

export type PrefabInsertMode =
  | 'group'
  | 'model'
  | 'particle'
  | 'nested-readonly'
  | 'nested-edit'
  | 'nested-clone';

export interface PrefabInsertResult {
  mode: PrefabInsertMode;
  modelId?: string;
  variantId?: string;
  particlePresetId?: string;
  prefabId?: string;
}

@Component({
  selector: 'app-prefab-insert-modal',
  standalone: true,
  imports: [FormsModule, DevModalComponent, DevModelPickerComponent],
  templateUrl: './prefab-insert-modal.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PrefabInsertModalComponent implements OnChanges {
  @Input() open = false;
  @Input() anchorLabel = '';
  @Input() models: LodEditorModelEntry[] = [];
  @Input() particlePresets: ParticlePresetEntry[] = [];
  @Input() prefabs: PrefabLibraryEntry[] = [];
  @Input() initialMode: PrefabInsertMode = 'model';
  @Input() currentPrefabId = '';

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<PrefabInsertResult>();

  insertMode: PrefabInsertMode = 'model';
  modelId = '';
  variantId = '';
  particlePresetId = '';
  prefabId = '';

  ngOnChanges(changes: SimpleChanges): void {
    const opened = changes['open']?.currentValue === true && changes['open']?.previousValue !== true;
    if (opened) {
      this.refreshDefaults();
    }
  }

  get particlePresetOptions() {
    return listParticlePresetOptionsForPrefab(this.particlePresets);
  }

  get availablePrefabs(): PrefabLibraryEntry[] {
    return this.prefabs.filter((entry) => entry.id !== this.currentPrefabId);
  }

  get selectedPrefabHasTree(): boolean {
    const entry = this.availablePrefabs.find((item) => item.id === this.prefabId);
    return (entry?.prefab.tree.length ?? 0) > 0;
  }

  get selectedParticlePresetHasTree(): boolean {
    const preset = this.particlePresets.find((item) => item.id === this.particlePresetId);
    return (preset?.effect.tree.length ?? 0) > 0;
  }

  onInsertModeChange(mode: PrefabInsertMode): void {
    this.insertMode = mode;
    if (mode === 'model' && !this.modelId && this.models.length) {
      this.modelId = this.models[0].id;
      this.variantId = firstVariantId(this.models, this.modelId);
    }
    if (mode === 'particle' && !this.particlePresetId && this.particlePresetOptions.length) {
      this.particlePresetId = this.particlePresetOptions[0].presetId;
    }
    if (mode.startsWith('nested') && !this.prefabId && this.availablePrefabs.length) {
      this.prefabId = this.availablePrefabs[0].id;
    }
  }

  onModelChange(modelId: string): void {
    this.modelId = modelId;
    this.variantId = firstVariantId(this.models, modelId);
  }

  submit(): void {
    if (this.insertMode === 'group') {
      this.confirm.emit({ mode: 'group' });
      return;
    }

    if (this.insertMode === 'model') {
      if (!this.modelId) return;
      this.confirm.emit({
        mode: 'model',
        modelId: this.modelId,
        variantId: this.variantId || firstVariantId(this.models, this.modelId),
      });
      return;
    }

    if (this.insertMode === 'particle') {
      if (!this.particlePresetId || !this.selectedParticlePresetHasTree) return;
      this.confirm.emit({ mode: 'particle', particlePresetId: this.particlePresetId });
      return;
    }

    if (!this.prefabId || !this.selectedPrefabHasTree) return;
    this.confirm.emit({ mode: this.insertMode, prefabId: this.prefabId });
  }

  get canSubmit(): boolean {
    if (this.insertMode === 'group') return true;
    if (this.insertMode === 'model') return !!this.modelId;
    if (this.insertMode === 'particle') {
      return !!(this.particlePresetId && this.selectedParticlePresetHasTree);
    }
    return !!(this.prefabId && this.selectedPrefabHasTree);
  }

  modelLabel(modelId: string): string {
    return findModelEntry(this.models, modelId)?.label ?? modelId;
  }

  private refreshDefaults(): void {
    this.insertMode = this.initialMode;
    this.modelId = this.models[0]?.id ?? '';
    this.variantId = this.modelId ? firstVariantId(this.models, this.modelId) : '';
    this.particlePresetId = this.particlePresetOptions[0]?.presetId ?? '';
    this.prefabId = this.availablePrefabs[0]?.id ?? '';
  }
}
