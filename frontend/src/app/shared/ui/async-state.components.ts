import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({ selector: 'app-loading-skeleton', imports: [TranslocoPipe], template: `<div class="skeleton-grid" [attr.aria-label]="'common.loading' | transloco" aria-busy="true"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div>` })
export class LoadingSkeletonComponent {}

@Component({ selector: 'app-error-state', imports: [TranslocoPipe], template: `<div class="state-panel error-panel" role="alert"><strong>{{ title() }}</strong><p>{{ text() }}</p><button class="button button-secondary" type="button" (click)="retry.emit()">{{ 'common.retry' | transloco }}</button></div>` })
export class ErrorStateComponent { readonly title = input(''); readonly text = input(''); readonly retry = output<void>(); }

@Component({ selector: 'app-empty-state', imports: [], template: `<div class="state-panel"><strong>{{ title() }}</strong><p>{{ text() }}</p><button class="button button-secondary" type="button" (click)="action.emit()">{{ actionLabel() }}</button></div>` })
export class EmptyStateComponent { readonly title = input(''); readonly text = input(''); readonly actionLabel = input(''); readonly action = output<void>(); }
