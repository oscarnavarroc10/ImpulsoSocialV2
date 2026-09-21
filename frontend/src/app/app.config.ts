import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTransloco, provideTranslocoLoader } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { TenantConfigService } from './core/config/tenant-config.service';
import { LocaleService } from './core/i18n/locale.service';
import { TranslationLoader } from './core/i18n/translation-loader';
import { ThemeService } from './core/theme/theme.service';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideTransloco({
      config: { availableLangs: ['es-MX', 'en'], defaultLang: 'es-MX', reRenderOnLangChange: true },
    }),
    provideTranslocoLoader(TranslationLoader),
    provideAppInitializer(async () => {
      const tenant = inject(TenantConfigService);
      const theme = inject(ThemeService);
      const locale = inject(LocaleService);
      const auth = inject(AuthService);

      await tenant.load();

      if (tenant.state() === 'ready') {
        theme.initialize();
        locale.initialize();
        auth.restore();
      }
    }),
  ],
};
