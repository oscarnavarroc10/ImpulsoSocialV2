import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { BrandLogoComponent } from '../../shared/ui/brand-logo.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LocaleSwitcherComponent } from '../../shared/ui/locale-switcher.component';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';

@Component({
  selector: 'app-account-dashboard',
  imports: [
    RouterLink,
    TranslocoPipe,
    BrandLogoComponent,
    IconComponent,
    LocaleSwitcherComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './account-dashboard.component.html',
})
export class AccountDashboardComponent {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly initials = computed(() => {
    const name = this.auth.user()?.nombre ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
