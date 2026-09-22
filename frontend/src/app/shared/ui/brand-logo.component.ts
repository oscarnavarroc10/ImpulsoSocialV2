import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-brand-logo',
  imports: [RouterLink],
  template: `<a
    class="brand"
    [routerLink]="destination()"
    [attr.aria-label]="config.config()?.brand?.name"
  >
    @if (logoUrl(); as logo) {
      <img class="brand-image" [src]="logo" [alt]="config.config()?.brand?.name ?? ''" />
    } @else {
      <span>{{ config.config()?.brand?.shortName }}</span>
    }
  </a>`,
})
export class BrandLogoComponent {
  readonly destination = input('/');
  protected readonly config = inject(TenantConfigService);
  private readonly theme = inject(ThemeService);

  protected logoUrl(): string | null {
    const brand = this.config.config()?.brand;
    if (!brand) return null;
    return (
      brand.personalityLogoUrls?.[this.theme.personality()] ??
      (this.theme.effectiveTheme() === 'dark' ? brand.logoDarkUrl : brand.logoLightUrl) ??
      null
    );
  }
}
