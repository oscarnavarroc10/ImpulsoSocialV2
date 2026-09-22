import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApiService } from '../../core/customer/catalog-api.service';
import { OrdersApiService } from '../../core/customer/orders-api.service';
import { CustomerBalanceStore } from '../../core/customer/customer-balance.store';
import {
  CatalogCategoryFacet,
  CatalogPlatformFacet,
  CatalogResponse,
  CatalogService,
  OrderRequestResult,
  ResourceState,
} from '../../core/customer/customer.models';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-customer-new-order',
  imports: [DecimalPipe, ReactiveFormsModule, TranslocoPipe, IconComponent],
  template: `
    <section class="account-page-heading customer-order-heading">
      <div>
        <span class="eyebrow">{{ 'account.newOrderEyebrow' | transloco }}</span>
        <h1>{{ 'account.newOrderTitle' | transloco }}</h1>
        <p>{{ 'account.newOrderIntro' | transloco }}</p>
      </div>
    </section>
    <ol class="customer-order-steps" [attr.aria-label]="'account.orderFlow' | transloco">
      <li class="is-current">
        <b aria-hidden="true">1</b>
        <span>
          <strong>{{ 'account.orderStepSelect' | transloco }}</strong>
          <small>{{ 'account.orderStepSelectDescription' | transloco }}</small>
        </span>
      </li>
      <li>
        <b aria-hidden="true">2</b>
        <span>
          <strong>{{ 'account.orderStepConfigure' | transloco }}</strong>
          <small>{{ 'account.orderStepConfigureDescription' | transloco }}</small>
        </span>
      </li>
      <li>
        <b aria-hidden="true">3</b>
        <span>
          <strong>{{ 'account.orderStepConfirm' | transloco }}</strong>
          <small>{{ 'account.orderStepConfirmDescription' | transloco }}</small>
        </span>
      </li>
    </ol>

    @if (state() === 'loading') {
      <div class="account-resource-message" role="status">
        {{ 'account.servicesLoading' | transloco }}
      </div>
    } @else {
      <form class="customer-order-layout" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="customer-order-main">
          <section class="account-card customer-order-form-card customer-order-selectors">
            <div class="form-field">
              <label for="order-network">{{ 'account.orderNetwork' | transloco }}</label>
              <div
                class="customer-order-choice-grid"
                role="group"
                [attr.aria-label]="'account.orderNetwork' | transloco"
              >
                @for (network of commercialNetworks(); track network.key) {
                  <button
                    class="customer-order-choice"
                    [class.is-active]="form.controls.socialNetwork.value === network.key"
                    [attr.aria-pressed]="form.controls.socialNetwork.value === network.key"
                    type="button"
                    (click)="selectNetwork(network)"
                  >
                    <app-icon [name]="networkIcon(network.key)" />
                    <strong>{{ network.label }}</strong>
                  </button>
                }
              </div>
              @if (commercialNetworks().length === 0) {
                <small class="form-error">{{
                  'account.orderClassificationUnavailable' | transloco
                }}</small>
              }
            </div>
            <div class="form-field">
              <span>{{ 'account.orderCategory' | transloco }}</span>
              <div class="customer-combobox" (click)="$event.stopPropagation()">
                <button
                  class="customer-combobox-trigger"
                  type="button"
                  role="combobox"
                  [attr.aria-expanded]="categoryOpen()"
                  [attr.aria-activedescendant]="
                    categoryOpen() ? 'order-category-option-' + categoryActiveIndex() : null
                  "
                  aria-controls="order-category-listbox"
                  [attr.aria-haspopup]="'listbox'"
                  (click)="toggleCategory($event)"
                  (keydown)="categoryKeydown($event)"
                >
                  <span>{{ selectedCategoryLabel() }}</span
                  ><app-icon name="arrowRight" />
                </button>
              </div>
            </div>
            <div class="form-field">
              <span>{{ 'account.orderService' | transloco }}</span>
              <div class="customer-combobox" (click)="$event.stopPropagation()">
                <button
                  class="customer-combobox-trigger"
                  type="button"
                  role="combobox"
                  [attr.aria-expanded]="serviceOpen()"
                  [attr.aria-activedescendant]="
                    serviceOpen() ? 'order-service-option-' + serviceActiveIndex() : null
                  "
                  aria-controls="order-service-listbox"
                  [attr.aria-haspopup]="'listbox'"
                  (click)="toggleService($event)"
                  (keydown)="serviceKeydown($event)"
                >
                  <span>{{ selectedServiceLabel() }}</span
                  ><app-icon name="arrowRight" />
                </button>
              </div>
            </div>
          </section>

          <section class="account-card customer-order-form-card">
            <div class="form-field">
              <label for="order-target">{{ 'account.target' | transloco }}</label>
              <input
                id="order-target"
                type="url"
                formControlName="target"
                [placeholder]="'account.targetPlaceholder' | transloco"
                autocomplete="url"
              />
              @if (form.controls.target.touched && form.controls.target.invalid) {
                <small class="form-error">{{ 'account.targetInvalid' | transloco }}</small>
              }
            </div>
            <div class="form-field">
              <label for="order-quantity">{{ 'account.quantity' | transloco }}</label>
              <input
                id="order-quantity"
                type="number"
                formControlName="quantity"
                inputmode="numeric"
                [min]="service()?.minQuantity ?? 1"
                [max]="service()?.maxQuantity ?? null"
                placeholder="{{ 'account.quantityPlaceholder' | transloco }}"
              />
              <small
                >{{ 'account.quantityRange' | transloco }}:
                {{
                  service()?.minQuantity === null || service()?.minQuantity === undefined
                    ? '—'
                    : (service()?.minQuantity | number)
                }}
                -
                {{
                  service()?.maxQuantity === null || service()?.maxQuantity === undefined
                    ? '—'
                    : (service()?.maxQuantity | number)
                }}</small
              >
              @if (form.controls.quantity.touched && form.controls.quantity.errors?.['required']) {
                <small class="form-error">{{ 'account.quantityRequired' | transloco }}</small>
              }
              @if (form.controls.quantity.touched && form.controls.quantity.errors?.['min']) {
                <small class="form-error">{{
                  'account.quantityTooLow' | transloco: { min: service()?.minQuantity }
                }}</small>
              }
              @if (form.controls.quantity.touched && form.controls.quantity.errors?.['max']) {
                <small class="form-error">{{
                  'account.quantityTooHigh' | transloco: { max: service()?.maxQuantity }
                }}</small>
              }
            </div>
            @if (submission() === 'unavailable') {
              <p class="form-error" role="alert">{{ 'account.orderError' | transloco }}</p>
            }
            @if (submission() === 'pending') {
              <p class="form-notice" role="status">{{ 'account.orderPending' | transloco }}</p>
            }
            @if (submission() === 'ready') {
              <p class="form-notice" role="status">{{ 'account.orderCreated' | transloco }}</p>
            }
            <button
              class="button button-primary customer-order-submit"
              type="submit"
              [disabled]="form.invalid || submission() === 'submitting'"
            >
              {{
                submission() === 'submitting'
                  ? ('account.orderProcessing' | transloco)
                  : ('account.createOrder' | transloco)
              }}<app-icon name="arrowRight" />
            </button>
          </section>
        </div>
        <aside class="customer-order-context" aria-labelledby="order-context-title">
          <span class="eyebrow">{{ 'account.orderSummary' | transloco }}</span>
          <h2 id="order-context-title">{{ 'account.orderContextTitle' | transloco }}</h2>
          <dl>
            <div>
              <dt>{{ 'account.orderNetwork' | transloco }}</dt>
              <dd>{{ selectedNetworkLabel() }}</dd>
            </div>
            <div>
              <dt>{{ 'account.servicesCategory' | transloco }}</dt>
              <dd>{{ service()?.category?.name ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'account.orderService' | transloco }}</dt>
              <dd>{{ service()?.title ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'account.quantity' | transloco }}</dt>
              <dd>
                {{ form.controls.quantity.value ? (form.controls.quantity.value | number) : '—' }}
              </dd>
            </div>
          </dl>
          <strong class="customer-order-context__total">{{ totalLabel() }}</strong>
          <small>{{ 'account.totalNote' | transloco }}</small>
        </aside>
      </form>
      @if (categoryOpen() || serviceOpen()) {
        <div class="customer-mobile-picker-layer">
          <button
            class="customer-combobox-picker-backdrop"
            type="button"
            (click)="categoryOpen.set(false); serviceOpen.set(false)"
            [attr.aria-label]="'account.closePicker' | transloco"
          ></button>
          @if (categoryOpen()) {
            <div
              class="customer-combobox-menu"
              [style.--picker-top.px]="pickerPosition().top"
              [style.--picker-left.px]="pickerPosition().left"
              [style.--picker-width.px]="pickerPosition().width"
              id="order-category-listbox"
              role="listbox"
              [attr.aria-label]="'account.orderCategory' | transloco"
            >
              <div class="customer-combobox-picker-header">
                <strong>{{ 'account.orderCategory' | transloco }}</strong
                ><button
                  type="button"
                  class="icon-button"
                  (click)="categoryOpen.set(false)"
                  [attr.aria-label]="'account.closePicker' | transloco"
                >
                  <app-icon name="close" />
                </button>
              </div>
              @for (category of categoriesForNetwork(); track category.id; let index = $index) {
                <button
                  class="customer-combobox-option"
                  [class.is-active]="form.controls.categoryId.value === category.id"
                  [attr.aria-selected]="form.controls.categoryId.value === category.id"
                  [attr.id]="'order-category-option-' + index"
                  role="option"
                  type="button"
                  (click)="selectCategory(category)"
                  (keydown)="categoryOptionKeydown($event, index)"
                >
                  <span>{{ category.name }}</span>
                </button>
              } @empty {
                <small class="customer-combobox-empty">{{
                  'account.servicesEmpty' | transloco
                }}</small>
              }
            </div>
          }
          @if (serviceOpen()) {
            <div
              class="customer-combobox-menu customer-service-combobox-menu"
              [style.--picker-top.px]="pickerPosition().top"
              [style.--picker-left.px]="pickerPosition().left"
              [style.--picker-width.px]="pickerPosition().width"
              id="order-service-listbox"
              role="listbox"
              [attr.aria-label]="'account.orderService' | transloco"
            >
              <div class="customer-combobox-picker-header">
                <strong>{{ 'account.orderService' | transloco }}</strong
                ><button
                  type="button"
                  class="icon-button"
                  (click)="serviceOpen.set(false)"
                  [attr.aria-label]="'account.closePicker' | transloco"
                >
                  <app-icon name="close" />
                </button>
              </div>
              <label class="customer-combobox-search"
                ><app-icon name="eye" /><span class="visually-hidden">{{
                  'account.serviceSearch' | transloco
                }}</span
                ><input
                  #serviceSearchInput
                  id="order-service-search"
                  type="search"
                  [value]="serviceSearch()"
                  (input)="serviceSearch.set($any($event.target).value)"
                  (keydown)="serviceSearchKeydown($event)"
                  [placeholder]="'account.serviceSearchPlaceholder' | transloco"
              /></label>
              @if (servicesState() === 'loading') {
                <small class="customer-combobox-empty" role="status">{{
                  'account.servicesLoading' | transloco
                }}</small>
              } @else if (servicesState() === 'unavailable') {
                <small class="customer-combobox-empty form-error" role="alert">{{
                  'account.servicesUnavailable' | transloco
                }}</small>
              } @else {
                <div class="customer-order-service-list">
                  @for (option of serviceOptions(); track option.id; let index = $index) {
                    <button
                      class="customer-combobox-option customer-service-option"
                      [class.is-active]="service()?.id === option.id"
                      [attr.aria-selected]="service()?.id === option.id"
                      [attr.id]="'order-service-option-' + index"
                      role="option"
                      type="button"
                      (click)="selectService(option)"
                      (keydown)="serviceOptionKeydown($event, index)"
                    >
                      <span class="customer-order-service__heading"
                        ><strong>{{ option.title }}</strong
                        ><b
                          >{{ option.sellingPrice.amount / 100 | number: '1.2-2' }}
                          {{ option.sellingPrice.currency }}</b
                        ></span
                      ><small
                        >{{ 'account.minimum' | transloco }} {{ option.minQuantity ?? '—' }} ·
                        {{ 'account.maximum' | transloco }} {{ option.maxQuantity ?? '—' }}</small
                      >
                    </button>
                  } @empty {
                    <small class="customer-combobox-empty">{{
                      'account.servicesEmpty' | transloco
                    }}</small>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    }
  `,
})
export class CustomerNewOrderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogApiService);
  private readonly orders = inject(OrdersApiService);
  private readonly balanceStore = inject(CustomerBalanceStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly service = signal<CatalogService | null>(null);
  protected readonly catalogResponse = signal<CatalogResponse | null>(null);
  protected readonly selectedNetwork = signal<CatalogPlatformFacet | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'unavailable'>('loading');
  protected readonly servicesState = signal<ResourceState>('empty');
  protected readonly loadedServices = signal<CatalogService[]>([]);
  protected readonly serviceSearch = signal('');
  protected readonly categoryOpen = signal(false);
  protected readonly serviceOpen = signal(false);
  protected readonly categoryActiveIndex = signal(0);
  protected readonly serviceActiveIndex = signal(0);
  protected readonly pickerPosition = signal({ top: 0, left: 0, width: 0 });
  protected readonly submission = signal<
    'idle' | 'submitting' | 'pending' | 'ready' | 'unavailable'
  >('idle');
  protected readonly form = this.fb.group({
    socialNetwork: [''],
    categoryId: [''],
    serviceId: [''],
    target: [
      '',
      [Validators.required, Validators.maxLength(2048), Validators.pattern(/^https?:\/\/[^\s]+$/)],
    ],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
  });

  constructor() {
    effect(() => {
      document.body.classList.toggle(
        'customer-mobile-picker-open',
        this.categoryOpen() || this.serviceOpen(),
      );
    });
    this.destroyRef.onDestroy(() => document.body.classList.remove('customer-mobile-picker-open'));
    const id = this.route.snapshot.queryParamMap.get('serviceId');
    this.catalog.list({ page: 1, limit: 100 }).subscribe((result) => {
      if (!result.response) {
        this.state.set('unavailable');
        return;
      }
      this.catalogResponse.set(result.response);
      this.state.set('ready');
      if (id)
        this.catalog
          .getById(id)
          .subscribe((selected) => selected && this.applyDeepLinkedService(selected));
    });
  }

  protected commercialNetworks(): CatalogPlatformFacet[] {
    return this.catalogResponse()?.facets.platforms ?? [];
  }

  protected categoriesForNetwork(): CatalogCategoryFacet[] {
    const network = this.form.controls.socialNetwork.value;
    return (this.catalogResponse()?.facets.categories ?? []).filter(
      (category) => category.platformKey === network,
    );
  }

  protected serviceOptions(): CatalogService[] {
    const query = this.serviceSearch().trim().toLowerCase();
    const options = this.loadedServices()
      .filter((item) => !query || `${item.title} ${item.description}`.toLowerCase().includes(query))
      .sort((left, right) => left.sellingPrice.amount - right.sellingPrice.amount);
    const selected = this.service();
    return selected && !options.some((option) => option.id === selected.id)
      ? [...options, selected].sort(
          (left, right) => left.sellingPrice.amount - right.sellingPrice.amount,
        )
      : options;
  }

  protected selectNetwork(network: CatalogPlatformFacet): void {
    this.form.controls.socialNetwork.setValue(network.key);
    this.form.controls.categoryId.setValue('');
    this.form.controls.serviceId.setValue('');
    this.service.set(null);
    this.loadedServices.set([]);
    this.serviceSearch.set('');
    this.servicesState.set('empty');
    this.selectedNetwork.set(network);
    this.categoryOpen.set(false);
    this.serviceOpen.set(false);
  }

  protected selectCategory(category: CatalogCategoryFacet): void {
    this.form.controls.categoryId.setValue(category.id);
    this.form.controls.serviceId.setValue('');
    this.service.set(null);
    this.serviceSearch.set('');
    this.categoryOpen.set(false);
    this.categoryActiveIndex.set(0);
    this.serviceOpen.set(false);
    this.loadCategoryServices();
  }

  protected selectService(selected: CatalogService): void {
    this.applyService(selected);
    this.serviceOpen.set(false);
    this.serviceActiveIndex.set(0);
  }

  protected toggleCategory(event?: Event): void {
    if (!this.form.controls.socialNetwork.value) return;
    if (event) this.setPickerPosition(event);
    this.categoryOpen.update((open) => !open);
    this.serviceOpen.set(false);
  }

  protected toggleService(event?: Event): void {
    if (!this.form.controls.categoryId.value || this.servicesState() === 'loading') return;
    if (event) this.setPickerPosition(event);
    this.serviceOpen.update((open) => !open);
    this.categoryOpen.set(false);
  }

  protected selectedCategoryLabel(): string {
    return (
      this.categoriesForNetwork().find(
        (category) => category.id === this.form.controls.categoryId.value,
      )?.name ?? '—'
    );
  }

  protected selectedServiceLabel(): string {
    return this.service()?.title ?? '—';
  }

  protected networkIcon(key: string): 'instagram' | 'tiktok' | 'youtube' | 'facebook' {
    const normalized = key.toLowerCase();
    if (normalized.includes('tiktok')) return 'tiktok';
    if (normalized.includes('youtube')) return 'youtube';
    if (normalized.includes('facebook')) return 'facebook';
    return 'instagram';
  }

  protected categoryKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleCategory(event);
    }
    if (event.key === 'Escape') this.categoryOpen.set(false);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.categoryOpen.set(true);
      this.moveCategory(event.key === 'ArrowDown' ? 1 : -1);
      this.focusOption('order-category-option-', this.categoryActiveIndex());
    }
  }

  protected serviceKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleService(event);
    }
    if (event.key === 'Escape') this.serviceOpen.set(false);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.serviceOpen.set(true);
      this.moveService(event.key === 'ArrowDown' ? 1 : -1);
      this.focusOption('order-service-option-', this.serviceActiveIndex());
    }
  }

  protected serviceSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.serviceOpen.set(false);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveService(1);
      this.focusOption('order-service-option-', this.serviceActiveIndex());
    }
  }

  protected categoryOptionKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.categoryActiveIndex.set(index);
      this.moveCategory(event.key === 'ArrowDown' ? 1 : -1);
      this.focusOption('order-category-option-', this.categoryActiveIndex());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const category = this.categoriesForNetwork()[index];
      if (category) this.selectCategory(category);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.categoryOpen.set(false);
    }
  }

  protected serviceOptionKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.serviceActiveIndex.set(index);
      this.moveService(event.key === 'ArrowDown' ? 1 : -1);
      this.focusOption('order-service-option-', this.serviceActiveIndex());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = this.serviceOptions()[index];
      if (option) this.selectService(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.serviceOpen.set(false);
    }
  }

  private moveCategory(delta: number): void {
    const total = this.categoriesForNetwork().length;
    if (total) this.categoryActiveIndex.update((index) => (index + delta + total) % total);
  }

  private moveService(delta: number): void {
    const total = this.serviceOptions().length;
    if (total) this.serviceActiveIndex.update((index) => (index + delta + total) % total);
  }

  private focusOption(prefix: string, index: number): void {
    setTimeout(() => {
      const option = document.getElementById(`${prefix}${index}`);
      option?.focus();
      option?.scrollIntoView({ block: 'nearest' });
    });
  }

  private setPickerPosition(event: Event): void {
    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement)) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = typeof window === 'undefined' ? rect.width : window.innerWidth;
    const width = Math.min(Math.max(rect.width, 280), Math.max(280, viewportWidth - 24));
    const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
    this.pickerPosition.set({ top: rect.bottom + 6, left, width });
  }

  @HostListener('document:click', ['$event'])
  protected closeComboboxes(event: MouseEvent): void {
    if (this.hostElement.nativeElement.contains(event.target as Node)) return;
    this.categoryOpen.set(false);
    this.serviceOpen.set(false);
  }

  private loadCategoryServices(afterLoad?: CatalogService): void {
    const socialNetwork = this.form.controls.socialNetwork.value;
    const categoryId = this.form.controls.categoryId.value;
    if (!socialNetwork || !categoryId) return;
    this.servicesState.set('loading');
    this.catalog.listAll({ socialNetwork, categoryId }).subscribe((result) => {
      this.servicesState.set(result.state);
      this.loadedServices.set(result.response?.items ?? []);
      if (afterLoad) this.applyService(afterLoad);
    });
  }

  private applyDeepLinkedService(selected: CatalogService): void {
    const network = this.commercialNetworks().find(
      (option) => option.key === selected.socialNetwork,
    );
    const category = this.catalogResponse()?.facets.categories.find(
      (option) =>
        option.id === selected.categoryId && option.platformKey === selected.socialNetwork,
    );
    if (!network || !category) {
      this.applyService(selected);
      return;
    }
    this.form.controls.socialNetwork.setValue(network.key);
    this.form.controls.categoryId.setValue(category.id);
    this.selectedNetwork.set(network);
    this.loadCategoryServices(selected);
  }

  private applyService(service: CatalogService): void {
    this.service.set(service);
    const network = this.commercialNetworks().find(
      (option) => option.key === service.socialNetwork,
    );
    const category = this.catalogResponse()?.facets.categories.find(
      (option) => option.id === service.categoryId && option.platformKey === service.socialNetwork,
    );
    if (network && category) {
      this.form.controls.socialNetwork.setValue(network.key);
      this.form.controls.categoryId.setValue(category.id);
      this.form.controls.serviceId.setValue(service.id);
      if (!this.loadedServices().some((option) => option.id === service.id))
        this.loadedServices.update((items) => [service, ...items]);
      this.selectedNetwork.set(network);
    } else {
      this.form.controls.serviceId.setValue(service.id);
    }
    this.form.controls.quantity.setValue('');
    this.form.controls.quantity.setValidators([
      Validators.required,
      Validators.pattern(/^\d+$/),
      Validators.min(service.minQuantity ?? 1),
      ...(service.maxQuantity === null ? [] : [Validators.max(service.maxQuantity)]),
    ]);
    this.form.controls.quantity.updateValueAndValidity();
  }

  protected selectedNetworkLabel(): string {
    return this.selectedNetwork()?.label ?? '—';
  }

  protected priceLabel(): string {
    const current = this.service();
    return current
      ? `${(current.sellingPrice.amount / 100).toFixed(2)} ${current.sellingPrice.currency}`
      : '—';
  }

  protected totalLabel(): string {
    const current = this.service();
    const quantity = Number(this.form.controls.quantity.value);
    if (
      !current ||
      !Number.isInteger(quantity) ||
      quantity < (current.minQuantity ?? 1) ||
      (current.maxQuantity !== null && quantity > current.maxQuantity)
    )
      return this.priceLabel();
    return `${((current.sellingPrice.amount * quantity + 999) / 1000 / 100).toFixed(2)} ${current.sellingPrice.currency}`;
  }

  protected submit(): void {
    if (this.form.invalid || !this.service() || this.submission() === 'submitting') {
      this.form.markAllAsTouched();
      return;
    }
    this.submission.set('submitting');
    const input = {
      serviceId: this.service()!.id,
      target: this.form.controls.target.value.trim(),
      quantity: Number(this.form.controls.quantity.value),
    };
    this.orders.create(input).subscribe((result: OrderRequestResult) => {
      this.submission.set(result.state === 'unavailable' ? 'unavailable' : result.state);
      if (result.state === 'ready') {
        this.balanceStore.reload();
        void this.router.navigate(['/cuenta/ordenes']);
      }
    });
  }
}
