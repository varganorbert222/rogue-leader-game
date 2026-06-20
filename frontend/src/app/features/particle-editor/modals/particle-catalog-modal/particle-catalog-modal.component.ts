import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ParticlePresetEntry } from '@rogue-leader/engine/dev';
import { DevModalComponent } from '../../../../shared/components/dev-modal/dev-modal.component';

export type ParticleCatalogInsertMode =
  | 'reference-readonly'
  | 'reference-edit'
  | 'clone'
  | 'blank';

export interface ParticleCatalogInsertResult {
  mode: ParticleCatalogInsertMode;
  presetId?: string;
}

@Component({
  selector: 'app-particle-catalog-modal',
  standalone: true,
  imports: [FormsModule, DevModalComponent],
  templateUrl: './particle-catalog-modal.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ParticleCatalogModalComponent implements OnChanges {
  @Input() open = false;
  @Input() anchorLabel = '';
  @Input() presets: ParticlePresetEntry[] = [];
  @Input() initialMode: ParticleCatalogInsertMode = 'blank';
  @Input() allowBlank = true;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<ParticleCatalogInsertResult>();

  insertMode: ParticleCatalogInsertMode = 'blank';
  presetId = '';
  showPresetFields = false;

  ngOnChanges(changes: SimpleChanges): void {
    const opened = changes['open']?.currentValue === true && changes['open']?.previousValue !== true;
    if (opened) {
      this.refreshDefaults();
    }
  }

  get selectedPresetHasTree(): boolean {
    const preset = this.presets.find((entry) => entry.id === this.presetId);
    return (preset?.effect.tree.length ?? 0) > 0;
  }

  onPresetChange(presetId: string): void {
    this.presetId = presetId;
  }

  onInsertModeChange(mode: ParticleCatalogInsertMode): void {
    this.insertMode = mode;
    this.showPresetFields = mode !== 'blank';
    if (mode === 'blank') return;
    if (!this.presetId) {
      this.presetId = this.presets[0]?.id ?? '';
    }
  }

  submit(): void {
    if (this.insertMode === 'blank') {
      this.confirm.emit({ mode: 'blank' });
      return;
    }

    if (!this.presetId || !this.selectedPresetHasTree) return;
    this.confirm.emit({
      mode: this.insertMode,
      presetId: this.presetId,
    });
  }

  get canSubmit(): boolean {
    if (this.insertMode === 'blank') return true;
    return !!(this.presetId && this.selectedPresetHasTree);
  }

  private refreshDefaults(): void {
    let mode = this.initialMode;
    if (!this.allowBlank && mode === 'blank') {
      mode = 'reference-readonly';
    }
    this.insertMode = mode;
    this.showPresetFields = mode !== 'blank';
    this.presetId = this.presets[0]?.id ?? '';
  }
}
