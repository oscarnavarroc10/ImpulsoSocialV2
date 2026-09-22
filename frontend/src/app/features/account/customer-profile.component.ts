import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-customer-profile',
  imports: [TranslocoPipe],
  template: `
    <section class="account-page-heading"><div><span class="eyebrow">{{ 'account.profileEyebrow' | transloco }}</span><h1>{{ 'account.profileTitle' | transloco }}</h1><p>{{ 'account.profileIntro' | transloco }}</p></div></section>
    <section class="account-card account-profile-card">
      <dl>
        <div><dt>{{ 'auth.name' | transloco }}</dt><dd>{{ auth.user()?.nombre }}</dd></div>
        <div><dt>{{ 'auth.email' | transloco }}</dt><dd>{{ auth.user()?.email }}</dd></div>
        <div><dt>{{ 'account.role' | transloco }}</dt><dd>{{ auth.user()?.rol }}</dd></div>
        <div><dt>{{ 'account.profilePhone' | transloco }}</dt><dd>{{ 'common.unavailable' | transloco }}</dd></div>
      </dl>
    </section>
  `,
})
export class CustomerProfileComponent {
  protected readonly auth = inject(AuthService);
}
