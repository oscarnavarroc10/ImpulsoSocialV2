import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { OrdersApiService } from '../../core/customer/orders-api.service';
import { CustomerOrdersComponent } from './customer-orders.component';

class Loader implements TranslocoLoader { getTranslation() { return of({ account: { ordersEyebrow: 'Orders', orders: 'My orders', ordersIntro: 'Intro', ordersLoading: 'Loading', ordersUnavailable: 'Unavailable', ordersEmpty: 'No orders', retry: 'Retry', viewCatalog: 'Catalog', orderItem: 'Order', orderDate: 'Date', quantity: 'Quantity', price: 'Price', servicesPage: 'Page {{page}} of {{totalPages}}', servicesPrevious: 'Previous', servicesNext: 'Next' } }); } }

const order = { id: 'order-1', serviceId: 'service-1', target: 'https://example.test', quantity: 500, totalPrice: { amount: 1500, currency: 'MXN' }, status: 'pending', createdAt: new Date().toISOString() };

describe('CustomerOrdersComponent', () => {
  it('renders pending orders and empty state from the API resource state', () => {
    TestBed.configureTestingModule({ imports: [CustomerOrdersComponent], providers: [provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }), provideTranslocoLoader(Loader), { provide: OrdersApiService, useValue: { list: () => of({ state: 'ready', response: { items: [order], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } } }) } }] });
    const fixture = TestBed.createComponent(CustomerOrdersComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('pending');
    expect(fixture.nativeElement.textContent).toContain('500');
  });
});
