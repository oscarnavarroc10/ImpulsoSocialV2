import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TranslocoLoader } from '@jsverse/transloco';
import { Observable, catchError, of } from 'rxjs';

const criticalTranslations: Record<string, unknown> = {
  common: { loading: 'Cargando', retry: 'Reintentar', menu: 'Menú', close: 'Cerrar', language: 'Idioma', theme: 'Tema' },
  errors: { configTitle: 'La tienda no está disponible', configText: 'No pudimos cargar la configuración. Intenta de nuevo más tarde.' },
};

@Injectable({ providedIn: 'root' })
export class TranslationLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/i18n/${lang}.json`).pipe(
      catchError(() => lang === 'es-MX' ? of(criticalTranslations) : this.http.get<Record<string, unknown>>('/i18n/es-MX.json').pipe(catchError(() => of(criticalTranslations)))),
    );
  }
}
