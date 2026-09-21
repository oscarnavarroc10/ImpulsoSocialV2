import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-about',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  template: `
    <section class="page-hero">
      <div class="shell page-hero-grid">
        <div>
          <span class="eyebrow">{{ 'navigation.about' | transloco }}</span>
          <h1>{{ 'about.title' | transloco }}</h1>
          <p class="page-lead">{{ 'about.intro' | transloco }}</p>
        </div>
        <div class="page-proof">
          <app-icon name="instagram" [large]="true" />
          <strong>{{ 'about.proofTitle' | transloco }}</strong>
          <p>{{ 'about.proofText' | transloco }}</p>
        </div>
      </div>
    </section>
    <section class="section shell about-grid">
      <div>
        <span class="eyebrow">{{ 'about.purposeEyebrow' | transloco }}</span>
        <h2>{{ 'about.purposeTitle' | transloco }}</h2>
      </div>
      <div class="prose-stack">
        <p>{{ 'about.text' | transloco }}</p>
        <p>{{ 'about.secondText' | transloco }}</p>
      </div>
    </section>
    <section class="section section-elevated">
      <div class="shell value-grid">
        @for (key of valueKeys; track key) {
          <article class="value-card">
            <app-icon name="check" />
            <h3>{{ 'about.values.' + key + '.title' | transloco }}</h3>
            <p>{{ 'about.values.' + key + '.text' | transloco }}</p>
          </article>
        }
      </div>
    </section>
    <section class="page-cta shell">
      <div>
        <h2>{{ 'about.ctaTitle' | transloco }}</h2>
        <p>{{ 'about.ctaText' | transloco }}</p>
      </div>
      <a class="button" routerLink="/services">{{ 'common.explore' | transloco }}</a>
    </section>
  `,
})
export class AboutComponent {
  protected readonly valueKeys = ['clarity', 'honesty', 'flexibility'] as const;
}
