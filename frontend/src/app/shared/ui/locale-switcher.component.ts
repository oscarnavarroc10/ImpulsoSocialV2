import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';

@Component({ selector: 'app-locale-switcher', imports: [TranslocoPipe], template: `<label class="locale-control"><span class="visually-hidden">{{ 'common.language' | transloco }}</span><select [value]="locale.locale()" (change)="change($event)" [attr.aria-label]="'common.language' | transloco"><option value="es-MX">{{ 'common.spanish' | transloco }}</option><option value="en">{{ 'common.english' | transloco }}</option></select></label>` })
export class LocaleSwitcherComponent {
  protected readonly locale = inject(LocaleService);
  protected change(event: Event): void { this.locale.setLocale((event.target as HTMLSelectElement).value as 'es-MX' | 'en'); }
}
