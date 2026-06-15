import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { LodEditorModelEntry } from '@rogue-leader/engine';
import { listVariantsForModel, shouldShowVariantPicker } from './dev-editor.utils';

@Component({
  selector: 'app-dev-model-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dev-model-picker.component.html',
  styleUrl: './dev-model-picker.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DevModelPickerComponent {
  @Input() models: LodEditorModelEntry[] = [];
  @Input() modelId = '';
  @Input() variantId = '';
  @Input() disabled = false;
  @Input() assetLabel = 'Asset';

  @Output() modelChange = new EventEmitter<string>();
  @Output() variantChange = new EventEmitter<string>();

  variants(): ReturnType<typeof listVariantsForModel> {
    return listVariantsForModel(this.models, this.modelId);
  }

  showVariantPicker(): boolean {
    return shouldShowVariantPicker(this.models, this.modelId);
  }
}
