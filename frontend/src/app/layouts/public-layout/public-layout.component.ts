import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BrandLogoComponent } from '../../shared/ui/brand-logo.component';
import { LocaleSwitcherComponent } from '../../shared/ui/locale-switcher.component';
import { ThemeToggleComponent } from '../../shared/ui/theme-toggle.component';
import { FloatingSocialActionsComponent } from '../../shared/ui/floating-social-actions.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-public-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoPipe,
    BrandLogoComponent,
    LocaleSwitcherComponent,
    ThemeToggleComponent,
    FloatingSocialActionsComponent,
    IconComponent,
  ],
  templateUrl: './public-layout.component.html',
})
export class PublicLayoutComponent {
  protected readonly config = inject(TenantConfigService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly menuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();
  protected readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  constructor() {
    this.destroyRef.onDestroy(() => this.unlockScroll());
  }
  protected toggleMenu(): void {
    this.menuOpen() ? this.closeMenu() : this.openMenu();
  }
  protected openMenu(): void {
    this.menuOpen.set(true);
    this.document.body.style.overflow = 'hidden';
  }
  protected closeMenu(): void {
    const wasOpen = this.menuOpen();
    this.menuOpen.set(false);
    this.unlockScroll();
    if (wasOpen) queueMicrotask(() => this.menuButton()?.nativeElement.focus());
  }
  protected handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closeMenu();
  }
  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
  private unlockScroll(): void {
    this.document.body.style.removeProperty('overflow');
  }
}
