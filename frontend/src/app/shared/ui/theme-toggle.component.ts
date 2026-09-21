import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemePreference } from '../../core/config/tenant-config.model';
import { ThemeService } from '../../core/theme/theme.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-theme-toggle',
  imports: [TranslocoPipe, IconComponent],
  template: `
    <div class="theme-switcher">
      <label class="preset-control">
        <span class="visually-hidden">{{ 'common.appearance' | transloco }}</span>
        <app-icon name="palette" />
        <select (change)="changePreset($event)" [attr.aria-label]="'common.appearance' | transloco">
          @for (preset of theme.presets(); track preset.key) {
            <option [value]="preset.key" [selected]="preset.key === theme.preset()">
              {{ preset.labelKey | transloco }}
            </option>
          }
        </select>
      </label>

      <label class="theme-control">
        <span class="visually-hidden">{{ 'common.theme' | transloco }}</span>
        <app-icon [name]="themeIcon()" />
        <select (change)="changePreference($event)" [attr.aria-label]="'common.theme' | transloco">
          <option value="light" [selected]="theme.preference() === 'light'">
            {{ 'common.light' | transloco }}
          </option>
          <option value="dark" [selected]="theme.preference() === 'dark'">
            {{ 'common.dark' | transloco }}
          </option>
          <option value="system" [selected]="theme.preference() === 'system'">
            {{ 'common.system' | transloco }}
          </option>
        </select>
      </label>
    </div>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);

  protected themeIcon(): 'sun' | 'moon' | 'system' {
    if (this.theme.preference() === 'light') return 'sun';
    if (this.theme.preference() === 'dark') return 'moon';
    return 'system';
  }

  protected changePreset(event: Event): void {
    this.theme.setPreset((event.target as HTMLSelectElement).value);
  }

  protected changePreference(event: Event): void {
    this.theme.setPreference((event.target as HTMLSelectElement).value as ThemePreference);
  }
}
