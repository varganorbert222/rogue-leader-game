import { Component, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-dev-inspector-section',
  standalone: true,
  template: `
    <section class="inspector-section">
      @if (title) {
        <h3>{{ title }}</h3>
      }
      <ng-content />
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DevInspectorSectionComponent {
  @Input() title = '';
}
