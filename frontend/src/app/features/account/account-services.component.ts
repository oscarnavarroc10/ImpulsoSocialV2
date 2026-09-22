import { Component, HostListener, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApiService } from '../../core/customer/catalog-api.service';
import {
  CatalogCategoryFacet,
  CatalogPlatformFacet,
  CatalogResponse,
  CatalogService,
  ResourceState,
} from '../../core/customer/customer.models';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-account-services',
  imports: [TranslocoPipe, IconComponent, DecimalPipe],
  template: `
    <section class="account-page-heading">
      <div>
        <h1>{{ 'account.servicesTitle' | transloco }}</h1>
        <p>{{ 'account.servicesIntro' | transloco }}</p>
      </div>
    </section>

    @if (state() === 'loading' && !response()) {
      <div class="account-resource-message" role="status">
        {{ 'account.servicesLoading' | transloco }}
      </div>
    } @else if (state() === 'unavailable') {
      <div class="account-resource-message" role="alert">
        <app-icon name="alert" />
        <span>{{ 'account.servicesUnavailable' | transloco }}</span>
        <button class="button button-small" type="button" (click)="load()">
          {{ 'account.retry' | transloco }}
        </button>
      </div>
    } @else if (platforms().length === 0) {
      <div class="account-resource-message">{{ 'account.servicesEmpty' | transloco }}</div>
    } @else {
      <section class="customer-catalog-section" aria-label="Catalog filters">
        <div class="customer-catalog-choice-grid customer-catalog-platform-grid">
          @for (platform of platforms(); track platform.key) {
            <button
              class="customer-catalog-choice customer-catalog-platform-choice"
              [class.is-active]="selectedPlatform()?.key === platform.key"
              [attr.aria-pressed]="selectedPlatform()?.key === platform.key"
              type="button"
              (click)="selectPlatform(platform)"
            >
              <app-icon [name]="networkIcon(platform.key)" />
              <strong>{{ platform.label }}</strong>
            </button>
          }
        </div>
      </section>

      @if (selectedPlatform(); as platform) {
        <section class="customer-catalog-categories" aria-label="{{ platform.label }} categories">
          @if (categoriesForSelectedPlatform().length === 0) {
            <div class="account-resource-message">{{ 'account.servicesEmpty' | transloco }}</div>
          } @else {
            <div class="customer-catalog-category-grid">
              @for (category of categoriesForSelectedPlatform(); track category.id) {
                <button
                  class="customer-catalog-choice customer-catalog-category-choice"
                  [class.is-active]="selectedCategory()?.id === category.id"
                  [attr.aria-pressed]="selectedCategory()?.id === category.id"
                  type="button"
                  (click)="selectCategory(category)"
                >
                  <strong>{{ category.name }}</strong>
                </button>
              }
            </div>
          }
        </section>
      }

      @if (selectedCategory()) {
        <section
          class="customer-catalog-services-section"
          aria-labelledby="catalog-services-heading"
        >
          <div class="customer-catalog-section-heading">
            <div>
              <span class="eyebrow"
                >{{ selectedPlatform()?.label }} · {{ selectedCategory()?.name }}</span
              >
              <h2 id="catalog-services-heading">
                {{ 'account.servicesAvailableTitle' | transloco }}
              </h2>
            </div>
            @if (selectedCategory()) {
              <label class="customer-catalog-search">
                <span class="visually-hidden">{{ 'account.serviceSearch' | transloco }}</span>
                <input
                  type="search"
                  [value]="search()"
                  (input)="onSearchChange($any($event.target).value)"
                  [placeholder]="'account.serviceSearchPlaceholder' | transloco"
                />
              </label>
            }
          </div>
          @if (state() === 'loading' && services().length === 0) {
            <div class="account-resource-message" role="status">
              {{ 'account.servicesLoading' | transloco }}
            </div>
          } @else if (state() === 'empty') {
            <div class="account-resource-message">{{ 'account.servicesEmpty' | transloco }}</div>
          } @else {
            <div class="customer-service-list">
              @for (service of filteredServices(); track service.id) {
                <article class="customer-service-row">
                  <div class="customer-service-row__main">
                    <h3>{{ service.title }}</h3>
                  </div>
                  <div class="customer-service-row__facts">
                    <strong
                      >{{ service.sellingPrice.amount / 100 | number: '1.2-2' }}
                      {{ service.sellingPrice.currency }} / 1000</strong
                    >
                    <span
                      >{{ 'account.minimumShort' | transloco }}
                      {{ service.minQuantity ?? '—' }}</span
                    >
                    <span
                      >{{ 'account.maximumShort' | transloco }}
                      {{ service.maxQuantity ?? '—' }}</span
                    >
                  </div>
                  <button
                    class="button button-small customer-service-row__action"
                    type="button"
                    (click)="openDetails(service)"
                  >
                    {{ 'account.serviceDetails' | transloco }}<app-icon name="arrowRight" />
                  </button>
                </article>
              } @empty {
                <div class="account-resource-message">
                  {{ 'account.servicesEmpty' | transloco }}
                </div>
              }
            </div>
            @if (hasMorePages()) {
              <button
                class="button button-secondary customer-catalog-load-more"
                type="button"
                [disabled]="state() === 'loading'"
                (click)="loadMore()"
              >
                {{
                  state() === 'loading'
                    ? ('account.servicesLoading' | transloco)
                    : ('account.servicesLoadMore' | transloco)
                }}
              </button>
            }
            @if (totalPages() > 1) {
              <nav
                class="customer-catalog-pagination"
                [attr.aria-label]="'common.pagination' | transloco"
              >
                <button
                  class="button button-small"
                  type="button"
                  [disabled]="currentPage() === 1 || state() === 'loading'"
                  (click)="goToPage(currentPage() - 1)"
                >
                  {{ 'account.servicesPrevious' | transloco }}
                </button>
                <div class="customer-catalog-pagination__pages">
                  @for (page of paginationPages(); track $index) {
                    @if (page === '...') {
                      <span aria-hidden="true">...</span>
                    } @else {
                      <button
                        class="button button-small"
                        type="button"
                        [class.is-active]="page === currentPage()"
                        [attr.aria-current]="page === currentPage() ? 'page' : null"
                        [disabled]="state() === 'loading'"
                        (click)="goToPage(page)"
                      >
                        {{ page }}
                      </button>
                    }
                  }
                </div>
                <button
                  class="button button-small"
                  type="button"
                  [disabled]="currentPage() === totalPages() || state() === 'loading'"
                  (click)="goToPage(currentPage() + 1)"
                >
                  {{ 'account.servicesNext' | transloco }}
                </button>
              </nav>
            }
          }
        </section>
      }
    }
    @if (detailsService(); as service) {
      <div class="customer-service-dialog-layer">
        <button
          class="customer-service-dialog-backdrop"
          type="button"
          (click)="closeDetails()"
          [attr.aria-label]="'account.closeDetails' | transloco"
        ></button>
        <section
          class="customer-service-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-service-dialog-title"
        >
          <header class="customer-service-dialog__header">
            <h2 id="customer-service-dialog-title">{{ service.title }}</h2>
            <button
              class="icon-button"
              type="button"
              (click)="closeDetails()"
              [attr.aria-label]="'account.closeDetails' | transloco"
            >
              <app-icon name="close" />
            </button>
          </header>
          <div class="customer-service-dialog__body">
            <div class="customer-service-dialog__context">
              <span>{{ service.socialNetwork }}</span>
              <span>{{ service.category?.name }}</span>
            </div>
            @if (service.description?.trim(); as description) {
              <p class="customer-service-dialog__description">{{ description }}</p>
            }
            <dl class="customer-service-dialog__facts">
              <div>
                <dt>{{ 'account.price' | transloco }}</dt>
                <dd>
                  {{ service.sellingPrice.amount / 100 | number: '1.2-2' }}
                  {{ service.sellingPrice.currency }} / 1000
                </dd>
              </div>
              <div>
                <dt>{{ 'account.minimum' | transloco }}</dt>
                <dd>{{ service.minQuantity ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ 'account.maximum' | transloco }}</dt>
                <dd>{{ service.maxQuantity ?? '—' }}</dd>
              </div>
              @if (service.serviceMetadata; as metadata) {
                <div>
                  <dt>{{ 'account.refill' | transloco }}</dt>
                  <dd>
                    {{
                      metadata.refill
                        ? ('account.supported' | transloco)
                        : ('account.notSupported' | transloco)
                    }}
                  </dd>
                </div>
                <div>
                  <dt>{{ 'account.cancel' | transloco }}</dt>
                  <dd>
                    {{
                      metadata.cancel
                        ? ('account.supported' | transloco)
                        : ('account.notSupported' | transloco)
                    }}
                  </dd>
                </div>
              }
            </dl>
          </div>
          <footer class="customer-service-dialog__footer">
            <button class="button button-primary" type="button" (click)="createOrder(service.id)">
              {{ 'account.createOrder' | transloco }}<app-icon name="arrowRight" />
            </button>
          </footer>
        </section>
      </div>
    }
  `,
})
export class AccountServicesComponent {
  private readonly catalog = inject(CatalogApiService);
  private readonly router = inject(Router);
  protected readonly state = signal<ResourceState>('loading');
  protected readonly services = signal<CatalogService[]>([]);
  protected readonly response = signal<CatalogResponse | null>(null);
  protected readonly selectedPlatform = signal<CatalogPlatformFacet | null>(null);
  protected readonly selectedCategory = signal<CatalogCategoryFacet | null>(null);
  protected readonly search = signal('');
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly detailsService = signal<CatalogService | null>(null);
  private categoryRequestId = 0;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.catalog.list({ page: 1, limit: 100 }).subscribe((result) => {
      this.services.set(result.response?.items ?? []);
      this.response.set(result.response);
      this.state.set(result.state);
    });
  }

  protected platforms(): CatalogPlatformFacet[] {
    const facets = this.response()?.facets;
    return facets?.platforms ?? [];
  }

  protected categoriesForSelectedPlatform(): CatalogCategoryFacet[] {
    const facets = this.response()?.facets;
    const platform = this.selectedPlatform();
    if (!facets || !platform) return [];
    return facets.categories.filter((category) => category.platformKey === platform.key);
  }

  protected selectPlatform(platform: CatalogPlatformFacet): void {
    this.selectedPlatform.set(platform);
    this.selectedCategory.set(null);
    this.services.set([]);
    this.search.set('');
    this.response.update((current) => (current ? { ...current, items: [] } : current));
    this.currentPage.set(1);
    this.totalPages.set(1);
  }

  protected selectCategory(category: CatalogCategoryFacet): void {
    this.selectedCategory.set(category);
    this.search.set('');
    this.loadCategoryPage(1, false);
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.selectedCategory()) this.loadCategoryPage(1, false);
  }

  protected hasMorePages(): boolean {
    return this.currentPage() < this.totalPages();
  }

  protected paginationPages(): Array<number | '...'> {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  protected loadMore(): void {
    if (this.state() === 'loading' || !this.hasMorePages()) return;
    this.loadCategoryPage(this.currentPage() + 1, true);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || this.state() === 'loading') return;
    this.loadCategoryPage(page, false);
  }

  private loadCategoryPage(page: number, append: boolean): void {
    const category = this.selectedCategory();
    if (!category) return;
    const requestId = ++this.categoryRequestId;
    this.state.set('loading');
    this.catalog
      .list({ page, limit: 12, socialNetwork: category.platformKey, categoryId: category.id })
      .subscribe((result) => {
        if (requestId !== this.categoryRequestId) return;
        const nextItems = result.response?.items ?? [];
        const items = append
          ? [
              ...this.services(),
              ...nextItems.filter(
                (item) => !this.services().some((loaded) => loaded.id === item.id),
              ),
            ]
          : nextItems;
        this.services.set(items);
        this.response.update((current) =>
          result.response ? { ...result.response, items } : current,
        );
        this.currentPage.set(result.response?.pagination.page ?? page);
        this.totalPages.set(result.response?.pagination.totalPages ?? 1);
        this.state.set(result.state);
      });
  }

  protected networkIcon(key: string): 'instagram' | 'tiktok' | 'youtube' | 'facebook' {
    const normalized = key.toLowerCase();
    if (normalized.includes('tiktok')) return 'tiktok';
    if (normalized.includes('youtube')) return 'youtube';
    if (normalized.includes('facebook')) return 'facebook';
    return 'instagram';
  }

  protected createOrder(serviceId: string): void {
    this.closeDetails();
    void this.router.navigate(['/cuenta/nueva-orden'], { queryParams: { serviceId } });
  }

  protected openDetails(service: CatalogService): void {
    this.detailsService.set(service);
  }

  protected closeDetails(): void {
    this.detailsService.set(null);
  }

  @HostListener('document:keydown.escape')
  protected closeDetailsOnEscape(): void {
    if (this.detailsService()) this.closeDetails();
  }

  protected filteredServices(): CatalogService[] {
    const query = this.search().trim().toLowerCase();
    return query
      ? this.services().filter((service) =>
          `${service.title} ${service.description}`.toLowerCase().includes(query),
        )
      : this.services();
  }

  protected quantityRange(service: CatalogService): string {
    if (service.minQuantity === null || service.maxQuantity === null) return '—';
    return `${service.minQuantity.toLocaleString()}–${service.maxQuantity.toLocaleString()}`;
  }
}
