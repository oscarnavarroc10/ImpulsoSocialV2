import { Component, input } from '@angular/core';
import { IconKey } from '../../core/config/tenant-config.model';

@Component({ selector: 'app-icon', template: `<svg class="icon" [class.icon-large]="large()" [attr.aria-hidden]="decorative()"><use [attr.href]="'/branding/impulsosocial/icons/' + name() + '.svg#icon'" /></svg>` })
export class IconComponent {
  readonly name = input.required<IconKey>();
  readonly decorative = input(true);
  readonly large = input(false);
}
