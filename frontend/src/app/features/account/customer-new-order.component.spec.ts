import '@angular/compiler';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { NEVER, Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CatalogApiService } from '../../core/customer/catalog-api.service';
import { OrdersApiService } from '../../core/customer/orders-api.service';
import { WalletApiService } from '../../core/customer/wallet-api.service';
import { CustomerBalanceStore } from '../../core/customer/customer-balance.store';
import { OrderRequestResult } from '../../core/customer/customer.models';
import { CustomerNewOrderComponent } from './customer-new-order.component';
import { ActivatedRoute, Router } from '@angular/router';

const makeService = (id: string, title = `Service ${id}`, amount = 15000) => ({
  id,
  title,
  description: 'Description',
  socialNetwork: 'Instagram',
  categoryId: 'category-1',
  category: { id: 'category-1', name: 'Followers', description: null },
  sellingPrice: { amount, currency: 'MXN' },
  minQuantity: 500,
  maxQuantity: 500000,
});

const translations = {
  account: {
    newOrderEyebrow: 'Order',
    newOrderTitle: 'New order',
    newOrderIntro: 'Intro',
    servicesLoading: 'Loading',
    servicesUnavailable: 'Unavailable',
    servicesEmpty: 'Empty',
    servicesAvailableCount: 'available',
    servicesCategory: 'Category',
    price: 'Price',
    minimum: 'Minimum',
    maximum: 'Maximum',
    target: 'Target',
    targetPlaceholder: 'https://example.test',
    targetInvalid: 'Invalid target',
    quantity: 'Quantity',
    quantityPlaceholder: 'Quantity',
    quantityRange: 'Range',
    quantityRequired: 'Required',
    quantityTooLow: 'Too low {{min}}',
    quantityTooHigh: 'Too high {{max}}',
    orderSummary: 'Summary',
    totalNote: 'Note',
    orderProcessing: 'Processing',
    orderCreated: 'Created',
    orderPending: 'Pending',
    orderError: 'Error',
    createOrder: 'Create order',
    orderNetwork: 'Social network',
    orderNetworkPlaceholder: 'Select a network',
    orderCategory: 'Category',
    orderCategoryPlaceholder: 'Select a category',
    orderService: 'Service',
    orderServicePlaceholder: 'Select a service',
    orderServiceInfo: 'Service information',
    orderClassificationUnavailable: 'Classification unavailable',
    serviceSearch: 'Search services',
    serviceSearchPlaceholder: 'Search',
    currentBalance: 'Available balance',
    walletLoading: 'Loading balance',
    balanceUnavailableShort: 'Unavailable',
  },
};

class Loader implements TranslocoLoader {
  getTranslation() {
    return of(translations);
  }
}

function makeResponse(
  items: ReturnType<typeof makeService>[],
  total = items.length,
  totalPages = 1,
) {
  return {
    items,
    facets: {
      platforms: [
        { key: 'Instagram', label: 'Instagram', serviceCount: total },
        { key: 'TikTok', label: 'TikTok', serviceCount: 0 },
        { key: 'YouTube', label: 'YouTube', serviceCount: 0 },
        { key: 'Facebook', label: 'Facebook', serviceCount: 0 },
      ],
      categories: [
        {
          id: 'category-1',
          name: 'Followers',
          description: null,
          platformKey: 'Instagram',
          serviceCount: total,
        },
        {
          id: 'category-2',
          name: 'Likes',
          description: null,
          platformKey: 'Instagram',
          serviceCount: 2,
        },
      ],
    },
    pagination: { page: 1, limit: 100, total, totalPages },
  };
}

function setup(
  options: {
    deepLink?: string;
    listAll?: ReturnType<typeof makeResponse>;
    createResult?: Observable<OrderRequestResult>;
  } = {},
) {
  const create = vi.fn<() => Observable<OrderRequestResult>>(() => options.createResult ?? NEVER);
  const reload = vi.fn();
  const first = makeResponse([makeService('initial')], 151, 2);
  const listAll = options.listAll ?? makeResponse([makeService('category-service')]);
  TestBed.configureTestingModule({
    imports: [CustomerNewOrderComponent],
    providers: [
      provideRouter([]),
      provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }),
      provideTranslocoLoader(Loader),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: () => options.deepLink ?? null } } },
      },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: OrdersApiService, useValue: { create } },
      {
        provide: CustomerBalanceStore,
        useValue: {
          state: signal('ready'),
          balance: signal({ balance: { amount: 12345, currency: 'MXN' } }),
          reload,
        },
      },
      {
        provide: WalletApiService,
        useValue: {
          balance: () =>
            of({
              state: 'ready' as const,
              response: { balance: { amount: 12345, currency: 'MXN' } },
            }),
        },
      },
      {
        provide: CatalogApiService,
        useValue: {
          list: () => of({ state: 'ready' as const, response: first }),
          listAll: () => of({ state: 'ready' as const, response: listAll }),
          getById: (id: string) =>
            of(id === 'deep-link' ? makeService('deep-link', 'Deep linked service') : null),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CustomerNewOrderComponent);
  fixture.detectChanges();
  return { fixture, create, reload };
}

describe('CustomerNewOrderComponent', () => {
  it('loads a category service absent from the initial global page', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Service category-service');
  });

  it('does not truncate a category returned across multiple pages', () => {
    const allServices = Array.from({ length: 150 }, (_, index) =>
      makeService(`service-${index}`, `Service ${index}`, (150 - index) * 100),
    );
    const { fixture } = setup({ listAll: makeResponse(allServices, 150, 2) });
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.customer-service-option')).toHaveLength(150);
    const prices = [...host.querySelectorAll('.customer-service-option b')].map((price) =>
      Number(price.textContent?.replace(/[^\d.]/g, '')),
    );
    expect(prices).toEqual([...prices].sort((left, right) => left - right));
  });

  it('renders every supported network with an icon and keeps service details in the combobox flow', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;
    for (const network of ['Instagram', 'TikTok', 'YouTube', 'Facebook']) {
      const button = [...host.querySelectorAll<HTMLButtonElement>('.customer-order-choice')].find(
        (option) => option.textContent?.includes(network),
      );
      expect(button?.querySelector('app-icon')).not.toBeNull();
    }
    expect(host.querySelector('.customer-order-card')).toBeNull();
  });

  it('filters services through the combobox search', () => {
    const services = [
      makeService('low', 'Budget followers', 1250),
      makeService('high', 'Premium likes', 3876),
    ];
    const { fixture } = setup({ listAll: makeResponse(services) });
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const search = host.querySelector<HTMLInputElement>('#order-service-search')!;
    search.value = 'premium';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.textContent).toContain('Premium likes');
    expect(host.textContent).not.toContain('Budget followers');
  });

  it('keeps the service combobox open while interacting with its search input', () => {
    const services = [makeService('low', 'Budget followers'), makeService('high', 'Premium likes')];
    const { fixture } = setup({ listAll: makeResponse(services) });
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    const search = host.querySelector<HTMLInputElement>('#order-service-search')!;
    search.focus();
    search.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    search.value = 'premium';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(host.querySelector('.customer-service-combobox-menu')).not.toBeNull();
    expect(host.textContent).toContain('Premium likes');
    expect(host.textContent).not.toContain('Budget followers');
  });

  it('closes on outside click and keeps mobile picker regions separate', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelector('.customer-combobox-picker-header')).not.toBeNull();
    expect(host.querySelector('.customer-combobox-search')).not.toBeNull();
    expect(host.querySelector('.customer-order-service-list')).not.toBeNull();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.customer-service-combobox-menu')).toBeNull();
  });

  it('does not auto-select the first service and keeps only the latest service selected', () => {
    const services = [
      makeService('first', 'First service'),
      makeService('second', 'Second service'),
    ];
    const { fixture } = setup({ listAll: makeResponse(services) });
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelectorAll('.customer-service-option[aria-selected="true"]')).toHaveLength(0);
    const options = host.querySelectorAll<HTMLButtonElement>('.customer-service-option');
    options[0].click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    const reopenedOptions = host.querySelectorAll<HTMLButtonElement>('.customer-service-option');
    expect(reopenedOptions).toHaveLength(2);
    reopenedOptions[1].click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(host.querySelectorAll('.customer-service-option[aria-selected="true"]')).toHaveLength(1);
    expect(host.querySelector('.customer-service-option.is-active')?.textContent).toContain(
      'Second service',
    );
  });

  it('closes the service combobox with Escape from the search input', () => {
    const { fixture } = setup();
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    host
      .querySelector<HTMLInputElement>('#order-service-search')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.customer-service-combobox-menu')).toBeNull();
  });

  it('resets category and service when the network changes', () => {
    const { fixture } = setup();
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          socialNetwork: { value: string };
          categoryId: { value: string };
          serviceId: { value: string };
        };
      };
    };
    const host = fixture.nativeElement as HTMLElement;
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Instagram'))!
      .click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    (host.querySelectorAll('.customer-combobox-trigger')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (host.querySelector('.customer-service-option') as HTMLButtonElement).click();
    fixture.detectChanges();
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Likes'))!
      .click();
    expect(component.form.controls.serviceId.value).toBe('');
    (host.querySelector('.customer-combobox-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Followers'))!
      .click();
    fixture.detectChanges();
    [...host.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('TikTok'))!
      .click();
    expect(component.form.controls.socialNetwork.value).toBe('TikTok');
    expect(component.form.controls.categoryId.value).toBe('');
    expect(component.form.controls.serviceId.value).toBe('');
  });

  it('supports serviceId deep links without creating an order or filling purchase details', () => {
    const { fixture, create } = setup({ deepLink: 'deep-link' });
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          target: { value: string };
          quantity: { value: string };
          serviceId: { value: string };
        };
      };
    };
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Deep linked service');
    expect(component.form.controls.serviceId.value).toBe('deep-link');
    expect(component.form.controls.target.value).toBe('');
    expect(component.form.controls.quantity.value).toBe('');
    expect(create).not.toHaveBeenCalled();
  });

  it('reloads the shared balance after a successful order', () => {
    const { fixture, reload } = setup({
      createResult: of({
        state: 'ready',
        order: {
          id: 'order-1',
          serviceId: 'selected',
          target: 'https://example.test/profile',
          quantity: 500,
          totalPrice: { amount: 15000, currency: 'MXN' },
          status: 'pending',
          createdAt: '2026-09-22T00:00:00.000Z',
        },
        statusCode: 201,
      }),
    });
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          target: { setValue(value: string): void };
          quantity: { setValue(value: string): void };
        };
      };
      selectNetwork(network: { key: string; label: string; serviceCount: number }): void;
      selectCategory(category: {
        id: string;
        name: string;
        description: null;
        platformKey: string;
        serviceCount: number;
      }): void;
      selectService(service: ReturnType<typeof makeService>): void;
      submit(): void;
    };
    component.selectNetwork({ key: 'Instagram', label: 'Instagram', serviceCount: 1 });
    component.selectCategory({
      id: 'category-1',
      name: 'Followers',
      description: null,
      platformKey: 'Instagram',
      serviceCount: 1,
    });
    component.selectService(makeService('selected'));
    component.form.controls.target.setValue('https://example.test/profile');
    component.form.controls.quantity.setValue('500');
    component.submit();
    expect(reload).toHaveBeenCalledOnce();
  });
});
