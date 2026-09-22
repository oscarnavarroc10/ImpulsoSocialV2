import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { OrdersApiService } from '../../core/customer/orders-api.service';
import { CustomerOrder, ResourceState } from '../../core/customer/customer.models';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-customer-orders',
  imports: [DatePipe, DecimalPipe, RouterLink, TranslocoPipe],
  template: `
    <section class="account-page-heading"><div><span class="eyebrow">{{ 'account.ordersEyebrow' | transloco }}</span><h1>{{ 'account.orders' | transloco }}</h1><p>{{ 'account.ordersIntro' | transloco }}</p></div></section>
    @if (state() === 'loading') { <div class="account-resource-message" role="status">{{ 'account.ordersLoading' | transloco }}</div> }
    @else if (state() === 'unavailable') { <div class="account-resource-message" role="alert"><span>{{ 'account.ordersUnavailable' | transloco }}</span><button class="button button-small" type="button" (click)="load()">{{ 'account.retry' | transloco }}</button></div> }
    @else if (state() === 'empty') { <div class="account-resource-message"><span>{{ 'account.ordersEmpty' | transloco }}</span><a class="button button-small" routerLink="/cuenta/servicios">{{ 'account.viewCatalog' | transloco }}</a></div> }
    @else { <div class="customer-orders-grid">@for (order of orders(); track order.id) { <article class="account-card customer-order-item"><div class="customer-order-item__top"><strong>{{ 'account.orderItem' | transloco }}</strong><span class="status-chip">{{ order.status }}</span></div><dl><div><dt>{{ 'account.orderDate' | transloco }}</dt><dd>{{ order.createdAt | date: 'mediumDate' }}</dd></div><div><dt>{{ 'account.quantity' | transloco }}</dt><dd>{{ order.quantity | number }}</dd></div><div><dt>{{ 'account.price' | transloco }}</dt><dd>{{ order.totalPrice.amount / 100 | number: '1.2-2' }} {{ order.totalPrice.currency }}</dd></div></dl><small>{{ order.target }}</small></article> } </div> @if (response(); as page) { @if (page.pagination.totalPages > 1) { <nav class="customer-catalog-pagination"><button class="button button-small button-ghost" [disabled]="page.pagination.page <= 1" (click)="load(page.pagination.page - 1)">{{ 'account.servicesPrevious' | transloco }}</button><span>{{ 'account.servicesPage' | transloco: { page: page.pagination.page, totalPages: page.pagination.totalPages } }}</span><button class="button button-small button-ghost" [disabled]="page.pagination.page >= page.pagination.totalPages" (click)="load(page.pagination.page + 1)">{{ 'account.servicesNext' | transloco }}</button></nav> } } }
  `,
})
export class CustomerOrdersComponent {
  private readonly api = inject(OrdersApiService);
  protected readonly state = signal<ResourceState>('loading');
  protected readonly orders = signal<CustomerOrder[]>([]);
  protected readonly response = signal<{ items: CustomerOrder[]; pagination: { page: number; totalPages: number } } | null>(null);
  constructor() { this.load(); }
  protected load(page = 1): void { this.state.set('loading'); this.api.list({ page, limit: 20 }).subscribe((result) => { this.state.set(result.state); this.orders.set(result.response?.items ?? []); this.response.set(result.response); }); }
}
