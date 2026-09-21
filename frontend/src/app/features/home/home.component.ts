import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly config = inject(TenantConfigService);
  protected readonly stepKeys = ['explore', 'configure', 'track'] as const;
  protected readonly benefitKeys = ['catalog', 'pricing', 'experience'] as const;
  protected readonly trustKeys = ['pricing', 'process', 'support'] as const;
  protected readonly faqKeys = ['explore', 'networks', 'results', 'purchase'] as const;

  protected activeNetwork() {
    return this.config
      .config()
      ?.catalog.networks.find((network) => network.enabled && network.key === 'instagram');
  }
}
