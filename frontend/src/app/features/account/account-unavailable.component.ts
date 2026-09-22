import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-account-unavailable',
  imports: [TranslocoPipe, IconComponent],
  template: `<section class="account-card account-unavailable" aria-live="polite">
    <app-icon name="alert" />
    <span class="eyebrow">{{ 'common.unavailable' | transloco }}</span>
    <h1>{{ titleKey | transloco }}</h1>
    <p>{{ textKey | transloco }}</p>
  </section>`,
})
export class AccountUnavailableComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly titleKey = this.route.snapshot.data['titleKey'] as string;
  protected readonly textKey = this.route.snapshot.data['textKey'] as string;
}