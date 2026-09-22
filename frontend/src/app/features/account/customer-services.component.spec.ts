import '@angular/compiler';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CatalogApiService } from '../../core/customer/catalog-api.service';
import { CustomerServicesComponent } from './customer-services.component';

const translations = {
  common: { pagination: 'Pagination' },
  account: {
    servicesEyebrow: 'Catalog',
    servicesTitle: 'Choose a service',
    servicesIntro: 'Intro',
    servicesChoosePlatform: 'Choose platform',
    servicesChooseCategory: 'Choose category',
    servicesPlatform: 'Platform',
    servicesCategory: 'Category',
    servicesPlatformHint: 'Select one',
    servicesAvailableTitle: 'Available services',
    servicesAvailableCount: 'available services',
    serviceSearch: 'Search services',
    serviceSearchPlaceholder: 'Search',
    servicesLoading: 'Loading',
    servicesUnavailable: 'Unavailable',
    servicesEmpty: 'Empty',
    servicesPrevious: 'Previous',
    servicesNext: 'Next',
    servicesPage: 'Page {{page}} of {{totalPages}}',
    servicesLoadMore: 'Load more',
    minimum: 'Minimum',
    maximum: 'Maximum',
    serviceDetails: 'Details',
    closeDetails: 'Close details',
    refill: 'Refill',
    cancel: 'Cancellation',
    supported: 'Supported',
    notSupported: 'Not supported',
    createOrder: 'Create order',
    price: 'Price',
    quantityRange: 'Quantity range',
    availability: 'Available',
    retry: 'Retry',
  },
};

class TestTranslationLoader implements TranslocoLoader {
  getTranslation() {
    return of(translations);
  }
}

describe('CustomerServicesComponent', () => {
  it('navigates from platform to category to server-backed services', () => {
    const navigate = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      imports: [CustomerServicesComponent],
      providers: [
        provideRouter([]),
        { provide: Router, useValue: { navigate } },
        provideTransloco({ config: { availableLangs: ['es-MX'], defaultLang: 'es-MX' } }),
        provideTranslocoLoader(TestTranslationLoader),
        {
          provide: CatalogApiService,
          useValue: {
            list: (options: { categoryId?: string; page?: number } = {}) =>
              of({
                state: 'ready' as const,
                response: {
                  items: options.categoryId
                    ? [
                        {
                          id: options.page === 2 ? 'service-2' : 'service-1',
                          title: options.page === 2 ? 'Followers premium' : 'Followers',
                          description: 'Real service',
                          socialNetwork: 'Instagram',
                          categoryId: 'cat-1',
                          category: { id: 'cat-1', name: 'Followers', description: null },
                          sellingPrice: { amount: 1250, currency: 'MXN' },
                          minQuantity: 100,
                          maxQuantity: null,
                          serviceMetadata: { refill: true, cancel: false },
                        },
                      ]
                    : [],
                  facets: {
                    platforms: [
                      { key: 'Instagram', label: 'Instagram', serviceCount: 1 },
                      { key: 'TikTok', label: 'TikTok', serviceCount: 1 },
                    ],
                    categories: [
                      {
                        id: 'cat-1',
                        name: 'Followers',
                        description: null,
                        platformKey: 'Instagram',
                        serviceCount: 1,
                      },
                    ],
                  },
                  pagination: {
                    page: 1,
                    limit: options.categoryId ? 12 : 100,
                    total: options.categoryId ? 2 : 1,
                    totalPages: options.categoryId ? 2 : 1,
                  },
                },
              }),
            listAll: () =>
              of({
                state: 'ready' as const,
                response: {
                  items: [
                    {
                      id: 'service-1',
                      title: 'Followers',
                      description: 'Real service',
                      socialNetwork: 'Instagram',
                      categoryId: 'cat-1',
                      category: { id: 'cat-1', name: 'Followers', description: null },
                      sellingPrice: { amount: 1250, currency: 'MXN' },
                      minQuantity: 100,
                      maxQuantity: null,
                    },
                  ],
                  facets: {
                    platforms: [
                      { key: 'Instagram', label: 'Instagram', serviceCount: 1 },
                      { key: 'TikTok', label: 'TikTok', serviceCount: 1 },
                    ],
                    categories: [
                      {
                        id: 'cat-1',
                        name: 'Followers',
                        description: null,
                        platformKey: 'Instagram',
                        serviceCount: 1,
                      },
                    ],
                  },
                  pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
                },
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CustomerServicesComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Instagram');
    expect(host.textContent).toContain('TikTok');
    const platformButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Instagram'),
    ) as HTMLButtonElement;
    platformButton.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('TikTok');
    expect(platformButton.classList.contains('is-active')).toBe(true);
    expect(host.textContent).toContain('Followers');
    expect(host.textContent).toContain('TikTok');
    const categoryButton = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Followers'),
    ) as HTMLButtonElement;
    categoryButton.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Followers');
    expect(host.textContent).toContain('12.50 MXN');
    expect(host.textContent).toContain('/ 1000');
    expect(host.querySelector('.customer-service-row__action')).not.toBeNull();
    expect(host.textContent).not.toContain('account.servicesTitle');
    host.querySelector<HTMLButtonElement>('.customer-service-row__action')!.click();
    fixture.detectChanges();
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Real service');
    expect(dialog.textContent).toContain('Instagram');
    expect(dialog.textContent).toContain('Followers');
    expect(dialog.textContent).toContain('12.50 MXN / 1000');
    expect(dialog.textContent).toContain('Refill');
    expect(dialog.textContent).toContain('Supported');
    expect(dialog.textContent).toContain('Cancellation');
    expect(dialog.textContent).toContain('Not supported');
    expect(dialog.textContent).not.toContain('service-1');
    expect(dialog.textContent).not.toContain('cat-1');
    dialog.querySelector<HTMLButtonElement>('.button-primary')!.click();
    expect(navigate).toHaveBeenCalledWith(['/cuenta/nueva-orden'], {
      queryParams: { serviceId: 'service-1' },
    });
    host.querySelector<HTMLButtonElement>('.customer-catalog-load-more')!.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.customer-service-row')).toHaveLength(2);
    expect(host.textContent).toContain('Followers premium');
    void navigate;
  });
});
