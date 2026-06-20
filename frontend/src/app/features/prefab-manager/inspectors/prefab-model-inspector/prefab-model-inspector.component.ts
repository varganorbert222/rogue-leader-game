import { Component, Input, ViewEncapsulation } from '@angular/core';
import type { LodEditorModelEntry, PrefabModelRef } from '@rogue-leader/engine/dev';
import { DevInspectorSectionComponent } from '../../../../shared/dev-editor/inspectors/dev-inspector-section/dev-inspector-section.component';
import {
  findModelEntry,
  variantLabel,
} from '../../../../shared/dev-editor/utils/dev-editor.utils';

@Component({
  selector: 'app-prefab-model-inspector',
  standalone: true,
  imports: [DevInspectorSectionComponent],
  templateUrl: './prefab-model-inspector.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PrefabModelInspectorComponent {
  @Input() name = '';
  @Input() modelRef: PrefabModelRef | null = null;
  @Input() models: LodEditorModelEntry[] = [];

  modelLabel(): string {
    if (!this.modelRef) return '—';
    return findModelEntry(this.models, this.modelRef.modelId)?.label ?? this.modelRef.modelId;
  }

  variantLabelText(): string {
    if (!this.modelRef) return '—';
    return variantLabel(this.models, this.modelRef.modelId, this.modelRef.variantId ?? '');
  }
}
