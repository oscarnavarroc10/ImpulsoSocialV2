import { Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-theme-toggle',
  imports: [TranslocoPipe, IconComponent],
  template: `
    <div class="theme-switcher">
      @if (!appearanceOnly()) {
        <div class="theme-segment" role="group" [attr.aria-label]="'common.theme' | transloco">
          <span class="visually-hidden">{{ 'common.theme' | transloco }}</span>
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
      }
      @if (!personalityOnly()) {
        <div class="theme-segment" role="group" [attr.aria-label]="'common.appearance' | transloco">
          <span class="visually-hidden">{{ 'common.appearance' | transloco }}</span>
          <button
            type="button"
            [class.is-active]="theme.preference() === 'light'"
            [attr.aria-pressed]="theme.preference() === 'light'"
            [attr.aria-label]="'common.light' | transloco"
            [attr.title]="'common.light' | transloco"
            (click)="theme.setPreference('light')"
          >
            <app-icon name="sun" /><span [class.visually-hidden]="iconOnly()">{{
              'common.light' | transloco
            }}</span>
          </button>
          <button
            type="button"
            [class.is-active]="theme.preference() === 'dark'"
            [attr.aria-pressed]="theme.preference() === 'dark'"
            [attr.aria-label]="'common.dark' | transloco"
            [attr.title]="'common.dark' | transloco"
            (click)="theme.setPreference('dark')"
          >
            <app-icon name="moon" /><span [class.visually-hidden]="iconOnly()">{{
              'common.dark' | transloco
            }}</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ThemeToggleComponent {
  readonly appearanceOnly = input(false);
  readonly personalityOnly = input(false);
  readonly iconOnly = input(false);
  protected readonly theme = inject(ThemeService);
}
