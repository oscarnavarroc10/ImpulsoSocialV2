import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-theme-toggle',
  imports: [TranslocoPipe, IconComponent],
  template: `
    <div class="theme-switcher">
      <div class="theme-segment" role="group" [attr.aria-label]="'common.visualStyle' | transloco">
        <span class="visually-hidden">{{ 'common.visualStyle' | transloco }}</span>
        @for (personality of theme.personalities; track personality.key) {
          <button
            type="button"
            [class.is-active]="theme.personality() === personality.key"
            [attr.aria-pressed]="theme.personality() === personality.key"
            (click)="theme.setPersonality(personality.key)"
          >
            {{ personality.labelKey | transloco }}
          </button>
        }
      </div>
      <div class="theme-segment" role="group" [attr.aria-label]="'common.appearance' | transloco">
        <span class="visually-hidden">{{ 'common.appearance' | transloco }}</span>
        <button
          type="button"
          [class.is-active]="theme.preference() === 'light'"
          [attr.aria-pressed]="theme.preference() === 'light'"
          (click)="theme.setPreference('light')"
        >
          <app-icon name="sun" /><span>{{ 'common.light' | transloco }}</span>
        </button>
        <button
          type="button"
          [class.is-active]="theme.preference() === 'dark'"
          [attr.aria-pressed]="theme.preference() === 'dark'"
          (click)="theme.setPreference('dark')"
        >
          <app-icon name="moon" /><span>{{ 'common.dark' | transloco }}</span>
        </button>
      </div>
    </div>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
