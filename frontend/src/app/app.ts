import { Component, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantConfigService } from './core/config/tenant-config.service';
import { ThemeService } from './core/theme/theme.service';
import { LocaleService } from './core/i18n/locale.service';
import { AuthService } from './core/auth/auth.service';

@Component({
  imports: [RouterOutlet, TranslocoPipe],
  selector: 'app-root',
  template: `@switch (config.state()) {
    @case ('loading') {
      <main class="config-loading" aria-live="polite">
        <span class="loading-mark" aria-hidden="true"></span>
        <p>{{ 'common.loading' | transloco }}</p>
      </main>
    }
    @case ('configurationError') {
      <main class="config-error" aria-live="assertive">
        <svg class="icon icon-large" aria-hidden="true">
          <use href="/branding/impulsosocial/icons/alert.svg#icon" />
        </svg>
        <h1>{{ 'errors.configTitle' | transloco }}</h1>
        <p>{{ 'errors.configText' | transloco }}</p>
        <button class="button" type="button" (click)="retry()">
          {{ 'common.retry' | transloco }}
        </button>
      </main>
    }
    @default {
      <router-outlet />
    }
  }`,
})
export class App {
  protected readonly config = inject(TenantConfigService);
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);
  private readonly locale = inject(LocaleService);
  private readonly auth = inject(AuthService);
  protected retry(): void {
    void this.retryConfiguration();
  }

  private async retryConfiguration(): Promise<void> {
    await this.config.retry();
    if (this.config.state() !== 'ready') return;

    this.theme.initialize();
    this.locale.initialize();
    this.auth.restore();
    this.transloco.setActiveLang(this.locale.locale());
  }
}
