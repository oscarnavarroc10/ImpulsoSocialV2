import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-customer-support',
  imports: [TranslocoPipe, IconComponent],
  template: `
    <section class="account-page-heading"><div><span class="eyebrow">{{ 'account.supportEyebrow' | transloco }}</span><h1>{{ 'account.support' | transloco }}</h1><p>{{ 'account.supportIntro' | transloco }}</p></div></section>
    <section class="account-card account-unavailable" aria-live="polite">
      <app-icon name="alert" />
      <span class="eyebrow">{{ 'common.unavailable' | transloco }}</span>
      <h2>{{ 'account.supportNotConfigured' | transloco }}</h2>
      <p>{{ 'account.supportUnavailable' | transloco }}</p>
    </section>
  `,
})
export class CustomerSupportComponent {}
