import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';

@Component({
  selector: 'app-locale-switcher',
  imports: [TranslocoPipe],
  template: `<div
    class="locale-control"
    role="group"
    [attr.aria-label]="'common.language' | transloco"
  >
    <span class="visually-hidden">{{ 'common.language' | transloco }}</span
    ><button
      type="button"
      [class.is-active]="locale.locale() === 'es-MX'"
      [attr.aria-pressed]="locale.locale() === 'es-MX'"
      (click)="change('es-MX')"
    >
      {{ 'common.spanishShort' | transloco }}</button
    ><button
      type="button"
      [class.is-active]="locale.locale() === 'en'"
      [attr.aria-pressed]="locale.locale() === 'en'"
      (click)="change('en')"
    >
      {{ 'common.englishShort' | transloco }}
    </button>
  </div>`,
})
export class LocaleSwitcherComponent {
  protected readonly locale = inject(LocaleService);
  protected change(locale: 'es-MX' | 'en'): void {
    this.locale.setLocale(locale);
  }
}
