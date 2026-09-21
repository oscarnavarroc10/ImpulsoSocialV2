import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-services',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  template: `
    <section class="placeholder-page shell">
      <div class="placeholder-icon"><app-icon name="instagram" [large]="true" /></div>
      <span class="eyebrow">{{ 'services.eyebrow' | transloco }}</span>
      <h1>{{ 'services.title' | transloco }}</h1>
      <p>{{ 'services.text' | transloco }}</p>
      <div class="placeholder-actions">
        <a class="button" routerLink="/">{{ 'common.backHome' | transloco }}</a>
        <a class="button button-ghost" routerLink="/faq">{{ 'navigation.faq' | transloco }}</a>
      </div>
    </section>
  `,
})
export class ServicesComponent {}
