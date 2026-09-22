import { DecimalPipe } from '@angular/common';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerBalanceStore } from '../../core/customer/customer-balance.store';
import { BrandLogoComponent } from '../../shared/ui/brand-logo.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { LocaleSwitcherComponent } from '../../shared/ui/locale-switcher.component';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';

@Component({
  selector: 'app-account-dashboard',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    DecimalPipe,
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
  protected readonly balanceStore = inject(CustomerBalanceStore);
  protected readonly initials = computed(() => {
    const name = this.auth.user()?.nombre ?? '';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });
  protected readonly navigationOpen = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly profileOpen = signal(false);

  protected toggleNavigation(): void {
    this.navigationOpen.update((open) => !open);
  }

  protected closeNavigation(): void {
    this.navigationOpen.set(false);
  }

  protected toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
    this.moreOpen.set(false);
  }

  protected closeProfile(): void {
    this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected handleEscape(): void {
    this.closeNavigation();
    this.closeMore();
    this.closeProfile();
  }

  protected async logout(): Promise<void> {
    this.closeMore();
    this.closeProfile();
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
