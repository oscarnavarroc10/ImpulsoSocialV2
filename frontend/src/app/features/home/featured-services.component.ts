import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/async-state.components';

export interface FeaturedPresentationItem { id: string; title: string; description: string; priceLabel: string; }
export type FeaturedPresentationState = 'loading' | 'empty' | 'error' | 'items';

@Component({ selector: 'app-featured-services', imports: [TranslocoPipe, LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent], template: `
  @switch (state()) {
    @case ('loading') { <app-loading-skeleton /> }
    @case ('error') { <app-error-state [title]="'errors.configTitle' | transloco" [text]="'errors.configText' | transloco" /> }
    @case ('empty') { <app-empty-state [title]="'common.ready' | transloco" [text]="'home.featuredIntro' | transloco" [actionLabel]="'common.explore' | transloco" /> }
    @case ('items') { <div class="service-grid">@for (item of items(); track item.id) { <article class="service-card"><span class="eyebrow">{{ 'common.instagram' | transloco }}</span><h3>{{ item.title }}</h3><p>{{ item.description }}</p><strong>{{ item.priceLabel }}</strong></article> }</div> }
  }
` })
export class FeaturedServicesComponent { readonly state = input<FeaturedPresentationState>('empty'); readonly items = input<readonly FeaturedPresentationItem[]>([]); }
