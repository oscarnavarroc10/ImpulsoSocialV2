import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-faq',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="page-hero compact-page-hero">
      <div class="shell">
        <span class="eyebrow">{{ 'navigation.faq' | transloco }}</span>
        <h1>{{ 'faq.title' | transloco }}</h1>
        <p class="page-lead">{{ 'faq.intro' | transloco }}</p>
      </div>
    </section>
    <section class="section shell faq-page-grid">
      <aside class="faq-aside">
        <h2>{{ 'faq.asideTitle' | transloco }}</h2>
        <p>{{ 'faq.asideText' | transloco }}</p>
        <a class="button button-ghost" routerLink="/services">{{ 'common.explore' | transloco }}</a>
      </aside>
      <div class="faq-list">
        @for (key of questionKeys; track key) {
          <details>
            <summary>{{ 'faq.items.' + key + '.question' | transloco }}</summary>
            <p>{{ 'faq.items.' + key + '.answer' | transloco }}</p>
          </details>
        }
      </div>
    </section>
  `,
})
export class FaqComponent {
  protected readonly questionKeys = [
    'explore',
    'networks',
    'results',
    'purchase',
    'payments',
    'customization',
  ] as const;
}
